import { beforeEach, describe, expect, it } from 'vitest';

import { OfferService } from '../src/application/services/offer-service.js';
import { createDatabase } from '../src/infrastructure/db/database.js';
import { KyselyUnitOfWork } from '../src/infrastructure/db/unit-of-work.js';
import { FixedClock, ManualScheduler, RecordingEventBus } from './helpers.js';

const INPUT = { title: '2x1 en jeans', description: 'Solo por 10 minutos', durationMs: 600_000 };

interface Context {
  uow: KyselyUnitOfWork;
  events: RecordingEventBus;
  scheduler: ManualScheduler;
  clock: FixedClock;
  service: OfferService;
}

function createContext(): Context {
  const uow = new KyselyUnitOfWork(createDatabase(':memory:'));
  const events = new RecordingEventBus();
  const scheduler = new ManualScheduler();
  const clock = new FixedClock();
  const service = new OfferService({ uow, events, clock, scheduler });
  return { uow, events, scheduler, clock, service };
}

describe('OfferService', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createContext();
  });

  it('start persists, publishes started with endsAt = now + duration, arms timer', async () => {
    await ctx.service.start(INPUT);
    const [event] = ctx.events.ofKind('offer.changed');
    expect(event?.cause).toBe('started');
    expect(event?.offer?.endsAt).toBe(ctx.clock.now() + INPUT.durationMs);
    expect(ctx.scheduler.pending[0]?.delayMs).toBe(INPUT.durationMs);
    expect(ctx.service.getActive()).not.toBeNull();
  });

  it('rejects start while another offer is active', async () => {
    await ctx.service.start(INPUT);
    await expect(ctx.service.start(INPUT)).rejects.toThrow(/already active/);
  });

  it('expiry publishes expired with null offer and persists the removal', async () => {
    await ctx.service.start(INPUT);
    ctx.clock.advance(INPUT.durationMs + 1);
    await ctx.scheduler.runPending();
    const last = ctx.events.ofKind('offer.changed').at(-1);
    expect(last).toMatchObject({ offer: null, cause: 'expired' });
    expect(ctx.service.getActive()).toBeNull();
    expect(await ctx.uow.run((repos) => repos.settings.getFlashOffer())).toBeNull();
  });

  it('cancel disarms the timer and publishes cancelled', async () => {
    await ctx.service.start(INPUT);
    await ctx.service.cancel();
    expect(ctx.events.ofKind('offer.changed').at(-1)).toMatchObject({
      offer: null,
      cause: 'cancelled',
    });
    await ctx.scheduler.runPending();
    // The expiry callback was cancelled: no extra broadcast.
    expect(ctx.events.ofKind('offer.changed')).toHaveLength(2);
  });

  it('cancel without an active offer is a silent no-op', async () => {
    await expect(ctx.service.cancel()).resolves.toBeUndefined();
    expect(ctx.events.ofKind('offer.changed')).toHaveLength(0);
  });

  it('getActive treats an overdue offer as gone before the timer fires', async () => {
    await ctx.service.start(INPUT);
    ctx.clock.advance(INPUT.durationMs + 1);
    expect(ctx.service.getActive()).toBeNull();
  });

  it('recoverOnBoot re-arms a still-valid offer with the remaining time', async () => {
    await ctx.service.start(INPUT);
    // Simulate restart: fresh service over the same database.
    ctx.clock.advance(200_000);
    const scheduler = new ManualScheduler();
    const recovered = new OfferService({
      uow: ctx.uow,
      events: new RecordingEventBus(),
      clock: ctx.clock,
      scheduler,
    });
    await recovered.recoverOnBoot();
    expect(recovered.getActive()?.title).toBe(INPUT.title);
    expect(scheduler.pending[0]?.delayMs).toBe(INPUT.durationMs - 200_000);
  });

  it('recoverOnBoot silently clears an offer that expired during downtime', async () => {
    await ctx.service.start(INPUT);
    ctx.clock.advance(INPUT.durationMs + 1);
    const events = new RecordingEventBus();
    const recovered = new OfferService({
      uow: ctx.uow,
      events,
      clock: ctx.clock,
      scheduler: new ManualScheduler(),
    });
    await recovered.recoverOnBoot();
    expect(recovered.getActive()).toBeNull();
    expect(events.published).toHaveLength(0);
    expect(await ctx.uow.run((repos) => repos.settings.getFlashOffer())).toBeNull();
  });
});
