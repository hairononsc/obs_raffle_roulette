import { beforeEach, describe, expect, it } from 'vitest';

import { QueueService } from '../src/application/services/queue-service.js';
import { createSqliteDatabase } from '../src/infrastructure/db/database.js';
import { KyselyUnitOfWork } from '../src/infrastructure/db/unit-of-work.js';
import {
  FixedClock,
  RecordingEventBus,
  SequentialIds,
  insertPrizes,
  testPrize,
} from './helpers.js';

interface Context {
  uow: KyselyUnitOfWork;
  events: RecordingEventBus;
  clock: FixedClock;
  offerActive: { value: boolean };
  service: QueueService;
}

function createContext(): Context {
  const uow = new KyselyUnitOfWork(createSqliteDatabase(':memory:'));
  const events = new RecordingEventBus();
  const clock = new FixedClock();
  const offerActive = { value: false };
  const service = new QueueService(uow, events, new SequentialIds(), clock, {
    getActive: () => (offerActive.value ? {} : null),
  });
  return { uow, events, clock, offerActive, service };
}

describe('QueueService.add — eligibility snapshot', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = createContext();
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'free', name: 'Regalo' }),
      testPrize({ id: 'jean', name: 'Jean', conditions: { minPurchase: 700 } }),
      testPrize({ id: 'vip', name: 'VIP', conditions: { requiresApproval: true } }),
    ]);
  });

  it('persists the snapshot according to purchase context', async () => {
    const low = await ctx.service.add({ buyerName: 'Ana', spins: 1, purchaseAmount: 500 });
    expect(low.eligiblePrizeIds).toEqual(['free']);

    const high = await ctx.service.add({
      buyerName: 'Bea',
      spins: 1,
      purchaseAmount: 800,
      approvals: ['vip'],
    });
    expect(high.eligiblePrizeIds).toEqual(['free', 'jean', 'vip']);
  });

  it('without purchase data, min-purchase rules fail conservatively', async () => {
    const entry = await ctx.service.add({ buyerName: 'Caro', spins: 1 });
    expect(entry.eligiblePrizeIds).toEqual(['free']);
  });

  it('creates the customer and reuses it by normalized name', async () => {
    const first = await ctx.service.add({ buyerName: 'José Pérez', spins: 1, phone: '809-1' });
    const second = await ctx.service.add({ buyerName: '  jose   perez ', spins: 1 });
    expect(first.customerId).toBeDefined();
    expect(second.customerId).toBe(first.customerId);

    const customer = await ctx.uow.run((repos) =>
      repos.customers.findByNormalizedName('jose perez'),
    );
    expect(customer?.phone).toBe('809-1');
  });

  it('rejects an unknown profile id', async () => {
    await expect(
      ctx.service.add({ buyerName: 'Dani', spins: 1, profileId: 'ghost' }),
    ).rejects.toThrow(/PROFILE_NOT_FOUND|does not exist/);
  });

  it('applies profile membership and manual overrides', async () => {
    await ctx.uow.run((repos) =>
      repos.settings.setWheelProfiles([{ id: 'pro-1', name: 'Básico', prizeIds: ['free'] }]),
    );
    const base = await ctx.service.add({ buyerName: 'Eli', spins: 1, profileId: 'pro-1' });
    expect(base.eligiblePrizeIds).toEqual(['free']);

    const forced = await ctx.service.add({
      buyerName: 'Fio',
      spins: 1,
      profileId: 'pro-1',
      enabledPrizeIds: ['jean'],
      disabledPrizeIds: ['free'],
    });
    expect(forced.eligiblePrizeIds).toEqual(['jean']);
  });

  it('newCustomersOnly stops applying after the customer has spins', async () => {
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'nuevo', name: 'Nuevos', conditions: { newCustomersOnly: true } }),
    ]);
    const fresh = await ctx.service.add({ buyerName: 'Gala', spins: 1 });
    expect(fresh.eligiblePrizeIds).toContain('nuevo');

    // Simulate a past awarded spin for the same customer.
    await ctx.uow.run((repos) =>
      repos.spins.create({
        spinId: 'spin-x',
        entryId: fresh.id,
        buyerName: 'Gala',
        prizeId: 'free',
        prizeName: 'Regalo',
        targetSegmentIndex: 0,
        animation: { durationMs: 1000, extraRotations: 1 },
        status: 'completed',
        startedAt: ctx.clock.now(),
        completedAt: ctx.clock.now(),
        customerId: fresh.customerId ?? null,
      }),
    );
    const returning = await ctx.service.add({ buyerName: 'Gala', spins: 1 });
    expect(returning.eligiblePrizeIds).not.toContain('nuevo');
  });

  it('requiresActiveOffer follows the live offer state', async () => {
    await insertPrizes(ctx.uow, ctx.clock, [
      testPrize({ id: 'flash', name: 'Flash', conditions: { requiresActiveOffer: true } }),
    ]);
    const without = await ctx.service.add({ buyerName: 'Hana', spins: 1 });
    expect(without.eligiblePrizeIds).not.toContain('flash');

    ctx.offerActive.value = true;
    const withOffer = await ctx.service.add({ buyerName: 'Iris', spins: 1 });
    expect(withOffer.eligiblePrizeIds).toContain('flash');
  });
});
