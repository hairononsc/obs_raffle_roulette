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
    }).recoverOnBoot();

    expect(recovered).toBe(1);
    const history = await ctx.uow.run((repos) => repos.spins.history(10, 0));
    expect(history.total).toBe(1);
  });
});
