import { beforeEach, describe, expect, it } from 'vitest';

import { OfferProgramService } from '../src/application/services/offer-program-service.js';
import { OfferService } from '../src/application/services/offer-service.js';
import { PROGRAM_LEAD_IN_MS } from '../src/domain/offer-schedule.js';
import { createSqliteDatabase } from '../src/infrastructure/db/database.js';
import { KyselyUnitOfWork } from '../src/infrastructure/db/unit-of-work.js';
import {
  FixedClock,
  ManualScheduler,
  RecordingEventBus,
  SequenceRandom,
  SequentialIds,
} from './helpers.js';

const TEMPLATE = { title: '2x1 en jeans', description: 'Ahora', durationMs: 600_000 };
const START_INPUT = { liveDurationMs: 10_800_000, offerCount: 3 }; // 3h live

interface Context {
  uow: KyselyUnitOfWork;
  events: RecordingEventBus;
  /** The program's scheduler; the composed OfferService gets its own so
   *  fireNext() never accidentally expires an active offer. */
  scheduler: ManualScheduler;
  clock: FixedClock;
  offers: OfferService;
  service: OfferProgramService;
}

function createContext(rolls: number[] = []): Context {
  const uow = new KyselyUnitOfWork(createSqliteDatabase(':memory:'));
  const events = new RecordingEventBus();
  const scheduler = new ManualScheduler();
  const clock = new FixedClock();
  const offers = new OfferService({ uow, events, clock, scheduler: new ManualScheduler() });
  const service = new OfferProgramService({
    uow,
    events,
    clock,
    scheduler,
    rng: new SequenceRandom(rolls),
    ids: new SequentialIds(),
    offers,
  });
  return { uow, events, scheduler, clock, offers, service };
}

/** Advances the clock to the program's next fire time and runs timers. */
async function fireNext(ctx: Context): Promise<void> {
  const next = ctx.service.getState()?.fireAt[0];
  if (next === undefined) {
    throw new Error('no pending fire time');
  }
  ctx.clock.advance(next - ctx.clock.now());
  await ctx.scheduler.runPending();
}

describe('OfferProgramService pool', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createContext();
  });

  it('addTemplate persists with a generated id and broadcasts the pool', async () => {
    await ctx.service.addTemplate(TEMPLATE);
    const [event] = ctx.events.ofKind('offer.pool.changed');
    expect(event?.pool).toHaveLength(1);
    expect(event?.pool[0]).toMatchObject({ ...TEMPLATE, id: 'offer-tpl-001' });
    expect(await ctx.uow.run((r) => r.settings.getOfferPool())).toHaveLength(1);
  });

  it('removeTemplate removes and broadcasts; unknown id is a silent no-op', async () => {
    await ctx.service.addTemplate(TEMPLATE);
    await ctx.service.removeTemplate('offer-tpl-001');
    expect(await ctx.uow.run((r) => r.settings.getOfferPool())).toHaveLength(0);
    const before = ctx.events.ofKind('offer.pool.changed').length;
    await ctx.service.removeTemplate('nope');
    expect(ctx.events.ofKind('offer.pool.changed')).toHaveLength(before);
  });
});

describe('OfferProgramService program', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = createContext([0.5, 0.5, 0.5, 0]); // 3 rolls for schedule, 1 for template pick
    await ctx.service.addTemplate(TEMPLATE);
  });

  it('start plans, persists, publishes started and arms the first timer', async () => {
    await ctx.service.start(START_INPUT);
    const [event] = ctx.events.ofKind('offer.program.changed');
    expect(event?.cause).toBe('started');
    expect(event?.program?.fireAt).toHaveLength(3);
    expect(event?.program?.totalCount).toBe(3);
    expect(event?.program?.fireAt[0]).toBeGreaterThanOrEqual(ctx.clock.now() + PROGRAM_LEAD_IN_MS);
    const timer = ctx.scheduler.pending.find((task) => !task.cancelled);
    expect(timer?.delayMs).toBe((event?.program?.fireAt[0] ?? 0) - ctx.clock.now());
    expect(await ctx.uow.run((r) => r.settings.getOfferProgram())).not.toBeNull();
  });

  it('rejects start with an active program or an empty pool', async () => {
    await ctx.service.start(START_INPUT);
    await expect(ctx.service.start(START_INPUT)).rejects.toThrow(/already active/);

    const fresh = createContext();
    await expect(fresh.service.start(START_INPUT)).rejects.toThrow(/pool is empty/);
  });

  it('a fire launches a pool offer and advances the program', async () => {
    await ctx.service.start(START_INPUT);
    await fireNext(ctx);

    const offerEvents = ctx.events.ofKind('offer.changed');
    expect(offerEvents.at(-1)?.cause).toBe('started');
    expect(offerEvents.at(-1)?.offer?.title).toBe(TEMPLATE.title);

    const programEvents = ctx.events.ofKind('offer.program.changed');
    expect(programEvents.at(-1)?.cause).toBe('advanced');
    expect(programEvents.at(-1)?.program?.fireAt).toHaveLength(2);
    expect(programEvents.at(-1)?.program?.totalCount).toBe(3);
  });

  it('skips the slot silently when a manual offer is active', async () => {
    await ctx.service.start(START_INPUT);
    // Manual offer just before the scheduled fire.
    await ctx.offers.start({ title: 'Manual', description: '', durationMs: 1_800_000 });
    const offersBefore = ctx.events.ofKind('offer.changed').length;

    await fireNext(ctx);

    // No second offer started, but the slot was consumed.
    expect(ctx.events.ofKind('offer.changed')).toHaveLength(offersBefore);
    expect(ctx.events.ofKind('offer.program.changed').at(-1)?.cause).toBe('advanced');
  });

  it('skips silently when the pool was emptied mid-program', async () => {
    await ctx.service.start(START_INPUT);
    await ctx.service.removeTemplate('offer-tpl-001');
    const offersBefore = ctx.events.ofKind('offer.changed').length;

    await fireNext(ctx);

    expect(ctx.events.ofKind('offer.changed')).toHaveLength(offersBefore);
    expect(ctx.events.ofKind('offer.program.changed').at(-1)?.cause).toBe('advanced');
  });

  it('the last fire finishes the program and clears persistence', async () => {
    await ctx.service.start({ ...START_INPUT, offerCount: 1 });
    await fireNext(ctx);

    expect(ctx.events.ofKind('offer.program.changed').at(-1)).toMatchObject({
      program: null,
      cause: 'finished',
    });
    expect(ctx.service.getState()).toBeNull();
    expect(await ctx.uow.run((r) => r.settings.getOfferProgram())).toBeNull();
  });

  it('stop cancels the pending timer and publishes stopped', async () => {
    await ctx.service.start(START_INPUT);
    const fireTime = ctx.service.getState()?.fireAt[0] ?? 0;
    await ctx.service.stop();

    expect(ctx.events.ofKind('offer.program.changed').at(-1)).toMatchObject({
      program: null,
      cause: 'stopped',
    });
    ctx.clock.advance(fireTime - ctx.clock.now());
    await ctx.scheduler.runPending();
    // Timer was cancelled: no offer fired after stopping.
    expect(ctx.events.ofKind('offer.changed')).toHaveLength(0);

    // Idempotent.
    const before = ctx.events.ofKind('offer.program.changed').length;
    await ctx.service.stop();
    expect(ctx.events.ofKind('offer.program.changed')).toHaveLength(before);
  });

  it('recoverOnBoot drops missed times, keeps the future ones and stays silent', async () => {
    await ctx.service.start(START_INPUT);
    const planned = ctx.service.getState()?.fireAt ?? [];
    expect(planned).toHaveLength(3);

    // Restart between the first and second fire.
    ctx.clock.advance((planned[0] ?? 0) - ctx.clock.now() + 1);
    const events = new RecordingEventBus();
    const scheduler = new ManualScheduler();
    const recovered = new OfferProgramService({
      uow: ctx.uow,
      events,
      clock: ctx.clock,
      scheduler,
      rng: new SequenceRandom(),
      ids: new SequentialIds(),
      offers: ctx.offers,
    });
    await recovered.recoverOnBoot();

    expect(recovered.getState()?.fireAt).toEqual(planned.slice(1));
    expect(recovered.getState()?.totalCount).toBe(3);
    expect(events.published).toHaveLength(0);
    expect(scheduler.pending.some((task) => !task.cancelled)).toBe(true);
  });

  it('recoverOnBoot clears a program whose live window already ended', async () => {
    await ctx.service.start(START_INPUT);
    ctx.clock.advance(START_INPUT.liveDurationMs + 1);
    const recovered = new OfferProgramService({
      uow: ctx.uow,
      events: new RecordingEventBus(),
      clock: ctx.clock,
      scheduler: new ManualScheduler(),
      rng: new SequenceRandom(),
      ids: new SequentialIds(),
      offers: ctx.offers,
    });
    await recovered.recoverOnBoot();
    expect(recovered.getState()).toBeNull();
    expect(await ctx.uow.run((r) => r.settings.getOfferProgram())).toBeNull();
  });
});
