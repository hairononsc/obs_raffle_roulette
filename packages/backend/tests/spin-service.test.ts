import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../src/domain/errors.js';
import { SpinService } from '../src/application/services/spin-service.js';
import { createSqliteDatabase } from '../src/infrastructure/db/database.js';
import { KyselyUnitOfWork } from '../src/infrastructure/db/unit-of-work.js';
import {
  FixedClock,
  ManualScheduler,
  RecordingEventBus,
  SequenceRandom,
  SequentialIds,
  insertPrizes,
  insertQueueEntry,
  testPrize,
} from './helpers.js';

const TIMING = { landingGraceMs: 5000, celebrationMs: 6000 };

interface Context {
  uow: KyselyUnitOfWork;
  events: RecordingEventBus;
  scheduler: ManualScheduler;
  clock: FixedClock;
  service: SpinService;
}

function createContext(rolls: number[] = []): Context {
  const db = createSqliteDatabase(':memory:');
  const uow = new KyselyUnitOfWork(db);
  const events = new RecordingEventBus();
  const scheduler = new ManualScheduler();
  const clock = new FixedClock();
  const service = new SpinService({
    uow,
    events,
    ids: new SequentialIds(),
    clock,
    rng: new SequenceRandom(rolls),
    scheduler,
    timing: TIMING,
    offers: { getActive: () => null },
  });
  return { uow, events, scheduler, clock, service };
}

describe('SpinService.launch', () => {
  let ctx: Context;

  beforeEach(async () => {
    // roll 0.05 -> first prize ("jeans", weight 1 of total 5); second roll for rotations.
    ctx = createContext([0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'jeans', name: 'Pantalón', weight: 1, stock: 2 }),
      testPrize({ id: 'discount', name: 'Descuento', weight: 4, stock: null }),
    ]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1', spinsTotal: 2, spinsRemaining: 2 });
  });

  it('decides, reserves stock, consumes the spin and publishes events', async () => {
    const spin = await ctx.service.launch('entry-1');

    expect(spin.prizeId).toBe('jeans');
    expect(spin.targetSegmentIndex).toBe(0);
    expect(spin.status).toBe('spinning');

    const state = await ctx.uow.run(async (repos) => ({
      prize: await repos.prizes.findById('jeans'),
      entry: await repos.queue.findById('entry-1'),
    }));
    expect(state.prize?.stock).toBe(1);
    expect(state.entry?.spinsRemaining).toBe(1);

    expect(ctx.events.ofKind('spin.started')).toHaveLength(1);
    expect(ctx.events.ofKind('queue.changed')).toHaveLength(1);
    expect(ctx.events.ofKind('prizes.changed')).toHaveLength(1);
  });

  it('rejects a second launch while a spin is active', async () => {
    await ctx.service.launch('entry-1');
    await expect(ctx.service.launch('entry-1')).rejects.toMatchObject({
      code: 'SPIN_IN_PROGRESS',
    });
  });

  it('rejects unknown entries and exhausted entries', async () => {
    await expect(ctx.service.launch('nope')).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });

    await insertQueueEntry(ctx.uow, { id: 'entry-empty', spinsTotal: 1, spinsRemaining: 0 });
    await expect(ctx.service.launch('entry-empty')).rejects.toMatchObject({
      code: 'NO_SPINS_REMAINING',
    });
  });

  it('refuses to spin when no prize has stock', async () => {
    const empty = createContext();
    await insertPrizes(empty.uow, empty.clock, [testPrize({ id: 'only', stock: 0 })]);
    await insertQueueEntry(empty.uow, { id: 'entry-1' });

    await expect(empty.service.launch('entry-1')).rejects.toMatchObject({
      code: 'NO_STOCK_AVAILABLE',
    });
    // The failed launch must not consume the buyer's spin (transaction rollback).
    const entry = await empty.uow.run((repos) => repos.queue.findById('entry-1'));
    expect(entry?.spinsRemaining).toBe(3);
  });
});

describe('spin completion paths', () => {
  it('landed -> celebration timer -> completed', async () => {
    const ctx = createContext([0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [testPrize({ id: 'jeans', stock: 5 })]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1' });

    const spin = await ctx.service.launch('entry-1');
    await ctx.service.confirmLanded(spin.spinId);
    expect(ctx.service.getActiveSpin()?.status).toBe('celebrating');

    // Only the celebration timer remains armed (safety timer was cancelled).
    await ctx.scheduler.runPending();

    expect(ctx.service.hasActiveSpin()).toBe(false);
    const completed = ctx.events.ofKind('spin.completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.spinId).toBe(spin.spinId);
  });

  it('safety timeout completes the spin when the widget never confirms', async () => {
    const ctx = createContext([0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [testPrize({ id: 'jeans', stock: 5 })]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1' });

    await ctx.service.launch('entry-1');
    await ctx.scheduler.runPending(); // widget dead: only the safety timer fires

    expect(ctx.service.hasActiveSpin()).toBe(false);
    expect(ctx.events.ofKind('spin.completed')).toHaveLength(1);
  });

  it('rejects landing confirmations for stale or duplicate spins', async () => {
    const ctx = createContext([0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [testPrize({ id: 'jeans', stock: 5 })]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1' });

    await expect(ctx.service.confirmLanded('spin-ghost')).rejects.toBeInstanceOf(DomainError);

    const spin = await ctx.service.launch('entry-1');
    await ctx.service.confirmLanded(spin.spinId);
    await expect(ctx.service.confirmLanded(spin.spinId)).rejects.toMatchObject({
      code: 'SPIN_NOT_ACTIVE',
    });
  });

  it('a prize that hits stock 0 stays on the wheel but is never selected again', async () => {
    // Force "jeans" (stock 1) on the first spin; any roll afterwards.
    const ctx = createContext([0.05, 0, 0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'jeans', weight: 1, stock: 1 }),
      testPrize({ id: 'discount', weight: 4, stock: null }),
    ]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1', spinsTotal: 5, spinsRemaining: 5 });

    const first = await ctx.service.launch('entry-1');
    expect(first.prizeId).toBe('jeans');
    await ctx.scheduler.runPending();

    const second = await ctx.service.launch('entry-1');
    expect(second.prizeId).toBe('discount');
    // Layout unchanged: jeans still occupies segment 0.
    expect(second.targetSegmentIndex).toBe(1);
  });
});

describe('SpinService.recoverOnBoot', () => {
  it('closes spins interrupted by a crash', async () => {
    const ctx = createContext([0.05, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [testPrize({ id: 'jeans', stock: 5 })]);
    await insertQueueEntry(ctx.uow, { id: 'entry-1' });
    await ctx.service.launch('entry-1');

    // Simulate a fresh process pointing at the same database.
    const recovered = await new SpinService({
      uow: ctx.uow,
      events: new RecordingEventBus(),
      ids: new SequentialIds(),
      clock: ctx.clock,
      rng: new SequenceRandom(),
      scheduler: new ManualScheduler(),
      timing: TIMING,
      offers: { getActive: () => null },
    }).recoverOnBoot();

    expect(recovered).toBe(1);
    const history = await ctx.uow.run((repos) => repos.spins.history(10, 0));
    expect(history.total).toBe(1);
  });
});

describe('SpinService.launch — per-customer eligibility', () => {
  async function setup(rolls: number[]): Promise<Context> {
    const ctx = createContext(rolls);
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'jeans', name: 'Jean', weight: 1, stock: 5 }),
      testPrize({ id: 'discount', name: 'Descuento', weight: 4, stock: null }),
    ]);
    return ctx;
  }

  it('lands only inside the entry snapshot', async () => {
    // rng 0.99 would pick "discount" over the whole wheel; the snapshot
    // only allows "jeans".
    const ctx = await setup([0.99, 0]);
    await insertQueueEntry(ctx.uow, {
      id: 'entry-s',
      customerId: 'customer-001',
      eligiblePrizeIds: ['jeans'],
    });
    const spin = await ctx.service.launch('entry-s');
    expect(spin.prizeId).toBe('jeans');
  });

  it('throws NO_ELIGIBLE_PRIZES for an empty snapshot, NO_STOCK_AVAILABLE for an empty wheel', async () => {
    const ctx = await setup([0.5]);
    await insertQueueEntry(ctx.uow, { id: 'entry-e', eligiblePrizeIds: [] });
    await expect(ctx.service.launch('entry-e')).rejects.toThrow(/NO_ELIGIBLE_PRIZES|eligible/);

    const empty = createContext([0.5]);
    await insertQueueEntry(empty.uow, { id: 'entry-x' });
    await expect(empty.service.launch('entry-x')).rejects.toThrow(/no active prize/);
  });

  it('legacy entries without snapshot use the whole wheel', async () => {
    const ctx = await setup([0.99, 0]);
    await insertQueueEntry(ctx.uow, { id: 'entry-l' });
    const spin = await ctx.service.launch('entry-l');
    expect(spin.prizeId).toBe('discount');
  });

  it('profile weight overrides shift the selection', async () => {
    // Base weights jeans=1/discount=4: roll 0.5 -> threshold 2.5 -> discount.
    // Override jeans=100: total 104, threshold 52 -> jeans.
    const ctx = await setup([0.5, 0]);
    await ctx.uow.run((repos) =>
      repos.settings.setWheelProfiles([
        { id: 'boost', name: 'Boost', prizeIds: ['jeans', 'discount'], weightOverrides: { jeans: 100 } },
      ]),
    );
    await insertQueueEntry(ctx.uow, {
      id: 'entry-p',
      profileId: 'boost',
      eligiblePrizeIds: ['jeans', 'discount'],
    });
    const spin = await ctx.service.launch('entry-p');
    expect(spin.prizeId).toBe('jeans');
  });

  it('daily caps fill between registration and spin, and reset across midnight', async () => {
    const ctx = createContext([0.5, 0, 0.5, 0, 0.5, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'cap', name: 'Cap', weight: 1, conditions: { maxPerDay: 1 } }),
    ]);
    await insertQueueEntry(ctx.uow, { id: 'entry-a', eligiblePrizeIds: ['cap'] });
    await insertQueueEntry(ctx.uow, { id: 'entry-b', eligiblePrizeIds: ['cap'], spinsTotal: 2, spinsRemaining: 2 });

    await ctx.service.launch('entry-a');
    await ctx.scheduler.runPending(); // safety timer completes the spin

    // Same day: the cap is already consumed (in-flight counts by started_at).
    await expect(ctx.service.launch('entry-b')).rejects.toThrow(/NO_ELIGIBLE_PRIZES|eligible/);

    ctx.clock.advance(24 * 3_600_000); // next local day: cap resets
    const spin = await ctx.service.launch('entry-b');
    expect(spin.prizeId).toBe('cap');
  });

  it('oncePerCustomer blocks the second spin of the same entry', async () => {
    const ctx = createContext([0.1, 0, 0.1, 0]);
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'once', name: 'Único', weight: 1, conditions: { oncePerCustomer: true } }),
    ]);
    await insertQueueEntry(ctx.uow, {
      id: 'entry-o',
      customerId: 'customer-042',
      eligiblePrizeIds: ['once'],
      spinsTotal: 2,
      spinsRemaining: 2,
    });

    const first = await ctx.service.launch('entry-o');
    expect(first.prizeId).toBe('once');
    await ctx.scheduler.runPending();

    await expect(ctx.service.launch('entry-o')).rejects.toThrow(/NO_ELIGIBLE_PRIZES|eligible/);
  });

  it('persists the customer id on the spin record', async () => {
    const ctx = await setup([0.05, 0]);
    await insertQueueEntry(ctx.uow, {
      id: 'entry-c',
      customerId: 'customer-007',
      eligiblePrizeIds: ['jeans', 'discount'],
    });
    await ctx.service.launch('entry-c');
    const counts = await ctx.uow.run((repos) => repos.spins.countAwardsByCustomer('customer-007'));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1);
  });
});
