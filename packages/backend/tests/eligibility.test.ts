import type { Prize } from '@wheellive/shared';
import { describe, expect, it } from 'vitest';

import {
  applyWeightOverrides,
  evaluatePrize,
  filterEligible,
  filterEligibleAtLaunch,
  type EligibilityContext,
} from '../src/domain/eligibility.js';
import { testPrize } from './helpers.js';

const NOW = 1_730_000_000_000;

function ctx(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    now: NOW,
    dayOfWeek: 5, // viernes
    hour: 20,
    isNewCustomer: false,
    customerAwardCounts: {},
    prizeAwardCounts: {},
    offerActive: false,
    approvals: new Set(),
    ...overrides,
  };
}

function prize(overrides: Partial<Prize> = {}): Prize {
  return testPrize({ id: 'p1', ...overrides });
}

describe('evaluatePrize — physical availability', () => {
  it('rejects inactive and out-of-stock prizes', () => {
    expect(evaluatePrize(prize({ active: false }), ctx()).failedRules).toContain('inactive');
    expect(evaluatePrize(prize({ stock: 0 }), ctx()).failedRules).toContain('outOfStock');
  });

  it('unconditional prize with stock passes', () => {
    expect(evaluatePrize(prize(), ctx())).toEqual({ eligible: true, failedRules: [] });
  });
});

describe('evaluatePrize — manual overrides', () => {
  it('manualDisabled always wins, even over manualEnabled', () => {
    const result = evaluatePrize(
      prize(),
      ctx({ manualEnabled: new Set(['p1']), manualDisabled: new Set(['p1']) }),
    );
    expect(result.eligible).toBe(false);
    expect(result.failedRules).toContain('manuallyDisabled');
  });

  it('manualEnabled skips profile and conditions but never stock', () => {
    const gated = prize({
      conditions: { minPurchase: 1000, requiresApproval: true },
    });
    const forced = evaluatePrize(
      gated,
      ctx({ manualEnabled: new Set(['p1']), profile: { id: 'x', name: 'X', prizeIds: [] } }),
    );
    expect(forced.eligible).toBe(true);

    const noStock = evaluatePrize(
      prize({ stock: 0 }),
      ctx({ manualEnabled: new Set(['p1']) }),
    );
    expect(noStock.eligible).toBe(false);
  });
});

describe('evaluatePrize — purchase rules', () => {
  it('minPurchase passes/fails/conservative-on-missing', () => {
    const p = prize({ conditions: { minPurchase: 700 } });
    expect(evaluatePrize(p, ctx({ purchaseAmount: 800 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ purchaseAmount: 500 })).failedRules).toContain('minPurchase');
    expect(evaluatePrize(p, ctx()).failedRules).toContain('minPurchase');
  });

  it('maxPurchase and minItems behave the same way', () => {
    const p = prize({ conditions: { maxPurchase: 1000, minItems: 2 } });
    expect(evaluatePrize(p, ctx({ purchaseAmount: 900, itemsCount: 2 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ purchaseAmount: 1500, itemsCount: 1 })).failedRules).toEqual([
      'maxPurchase',
      'minItems',
    ]);
    expect(evaluatePrize(p, ctx()).failedRules).toEqual(['maxPurchase', 'minItems']);
  });
});

describe('evaluatePrize — schedule rules', () => {
  it('daysOfWeek', () => {
    const p = prize({ conditions: { daysOfWeek: [5, 6] } });
    expect(evaluatePrize(p, ctx({ dayOfWeek: 5 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ dayOfWeek: 2 })).failedRules).toContain('daysOfWeek');
  });

  it('hour window, inclusive', () => {
    const p = prize({ conditions: { hourStart: 18, hourEnd: 22 } });
    expect(evaluatePrize(p, ctx({ hour: 18 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ hour: 22 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ hour: 23 })).failedRules).toContain('hourWindow');
  });

  it('hour window crossing midnight', () => {
    const p = prize({ conditions: { hourStart: 20, hourEnd: 2 } });
    expect(evaluatePrize(p, ctx({ hour: 23 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ hour: 1 })).eligible).toBe(true);
    expect(evaluatePrize(p, ctx({ hour: 12 })).failedRules).toContain('hourWindow');
  });
});

describe('evaluatePrize — caps and customer rules', () => {
  it('maxPerDay/Week/Month against current counts', () => {
    const p = prize({ conditions: { maxPerDay: 2, maxPerWeek: 5, maxPerMonth: 10 } });
    const under = ctx({ prizeAwardCounts: { p1: { day: 1, week: 4, month: 9 } } });
    expect(evaluatePrize(p, under).eligible).toBe(true);
    const over = ctx({ prizeAwardCounts: { p1: { day: 2, week: 5, month: 10 } } });
    expect(evaluatePrize(p, over).failedRules).toEqual(['maxPerDay', 'maxPerWeek', 'maxPerMonth']);
  });

  it('oncePerCustomer, newCustomersOnly, requiresActiveOffer, requiresApproval', () => {
    const p = prize({
      conditions: {
        oncePerCustomer: true,
        newCustomersOnly: true,
        requiresActiveOffer: true,
        requiresApproval: true,
      },
    });
    const good = ctx({
      isNewCustomer: true,
      offerActive: true,
      approvals: new Set(['p1']),
    });
    expect(evaluatePrize(p, good).eligible).toBe(true);

    const bad = evaluatePrize(
      p,
      ctx({ customerAwardCounts: { p1: 1 }, isNewCustomer: false }),
    );
    expect(bad.failedRules).toEqual([
      'newCustomersOnly',
      'requiresApproval',
      'oncePerCustomer',
      'requiresActiveOffer',
    ]);
  });

  it('profile membership', () => {
    const inProfile = ctx({ profile: { id: 'pr', name: 'P', prizeIds: ['p1'] } });
    const outProfile = ctx({ profile: { id: 'pr', name: 'P', prizeIds: ['other'] } });
    expect(evaluatePrize(prize(), inProfile).eligible).toBe(true);
    expect(evaluatePrize(prize(), outProfile).failedRules).toContain('notInProfile');
  });
});

describe('filterEligible / filterEligibleAtLaunch', () => {
  const catalog = [
    testPrize({ id: 'a' }),
    testPrize({ id: 'b', conditions: { minPurchase: 1000 } }),
    testPrize({ id: 'c', active: false }),
  ];

  it('filterEligible returns only passing prizes', () => {
    const ids = filterEligible(catalog, ctx({ purchaseAmount: 500 })).map((p) => p.id);
    expect(ids).toEqual(['a']);
  });

  it('launch with null snapshot behaves as legacy (whole wheel)', () => {
    const ids = filterEligibleAtLaunch(catalog, null, ctx()).map((p) => p.id);
    expect(ids).toEqual(['a', 'b']); // c inactive; b's minPurchase is static, not re-checked
  });

  it('launch respects the snapshot and ignores deleted ids', () => {
    const snapshot = new Set(['a', 'deleted-prize']);
    const ids = filterEligibleAtLaunch(catalog, snapshot, ctx()).map((p) => p.id);
    expect(ids).toEqual(['a']);
  });

  it('launch re-checks dynamic rules only', () => {
    const dynamic = testPrize({ id: 'd', conditions: { maxPerDay: 1, minPurchase: 9999 } });
    const full = ctx({ prizeAwardCounts: { d: { day: 1, week: 1, month: 1 } } });
    // minPurchase (static) is ignored at launch; maxPerDay (dynamic) applies.
    expect(filterEligibleAtLaunch([dynamic], new Set(['d']), full)).toHaveLength(0);
    expect(filterEligibleAtLaunch([dynamic], new Set(['d']), ctx())).toHaveLength(1);
  });
});

describe('applyWeightOverrides', () => {
  it('overrides matching prizes and leaves the rest untouched', () => {
    const result = applyWeightOverrides(
      [testPrize({ id: 'a', weight: 1 }), testPrize({ id: 'b', weight: 2 })],
      { a: 9 },
    );
    expect(result.map((p) => p.weight)).toEqual([9, 2]);
  });

  it('without overrides returns an equivalent copy', () => {
    const input = [testPrize({ id: 'a' })];
    const result = applyWeightOverrides(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});
