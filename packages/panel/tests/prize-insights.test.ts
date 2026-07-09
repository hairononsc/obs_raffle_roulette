import type { Prize, QueueEntry } from '@wheellive/shared';
import { describe, expect, it } from 'vitest';

import {
  diffPrizeSelection,
  expectedCostPerSpin,
  formatConditionsFull,
  formatConditionsSummary,
  summarizeEligibility,
} from '../src/logic/prize-insights.js';

function prize(overrides: Partial<Prize> & Pick<Prize, 'id'>): Prize {
  return {
    name: overrides.id,
    weight: 1,
    stock: null,
    color: '#111111',
    icon: 'x',
    active: true,
    cost: 0,
    conditions: {},
    respin: false,
    ...overrides,
  };
}

function entry(overrides: Partial<QueueEntry>): QueueEntry {
  return {
    id: 'e1',
    buyerName: 'Ana',
    spinsTotal: 1,
    spinsRemaining: 1,
    createdAt: 0,
    ...overrides,
  };
}

describe('formatConditionsSummary', () => {
  it('empty conditions show a dash', () => {
    expect(formatConditionsSummary({})).toBe('—');
    expect(formatConditionsSummary(undefined)).toBe('—');
  });

  it('renders tokens and truncates past three', () => {
    expect(formatConditionsSummary({ minPurchase: 700, maxPerDay: 2 })).toBe(
      '≥RD$700 · máx 2/día',
    );
    const many = formatConditionsSummary({
      minPurchase: 700,
      maxPerDay: 2,
      oncePerCustomer: true,
      requiresApproval: true,
    });
    expect(many).toBe('≥RD$700 · máx 2/día · 1×cliente +1');
    expect(formatConditionsFull({ requiresApproval: true })).toBe('⚠ aprob.');
  });

  it('formats days and hour windows', () => {
    expect(formatConditionsSummary({ daysOfWeek: [5, 6], hourStart: 18, hourEnd: 22 })).toBe(
      'V·S · 18–22h',
    );
  });
});

describe('expectedCostPerSpin', () => {
  it('weights costs by probability, ignoring inactive and stock-0 prizes', () => {
    const prizes = [
      prize({ id: 'a', weight: 1, cost: 700 }),
      prize({ id: 'b', weight: 3, cost: 100 }),
      prize({ id: 'inactive', weight: 5, cost: 999, active: false }),
      prize({ id: 'agotado', weight: 5, cost: 999, stock: 0 }),
    ];
    // a: 25% × 700 = 175; b: 75% × 100 = 75
    expect(expectedCostPerSpin(prizes)).toBeCloseTo(250);
  });

  it('empty catalog costs zero', () => {
    expect(expectedCostPerSpin([])).toBe(0);
  });
});

describe('diffPrizeSelection', () => {
  it('returns only the deltas', () => {
    const baseline = new Set(['a', 'b']);
    expect(diffPrizeSelection(baseline, new Set(['a', 'b']))).toEqual({});
    expect(diffPrizeSelection(baseline, new Set(['a', 'c']))).toEqual({
      enabledPrizeIds: ['c'],
      disabledPrizeIds: ['b'],
    });
  });
});

describe('summarizeEligibility', () => {
  const prizes = [prize({ id: 'a', name: 'Jean' }), prize({ id: 'b', name: 'Gorra' })];

  it('null for legacy entries and for all-eligible snapshots', () => {
    expect(summarizeEligibility(entry({}), prizes, [])).toBeNull();
    expect(summarizeEligibility(entry({ eligiblePrizeIds: ['a', 'b'] }), prizes, [])).toBeNull();
  });

  it('reports blocked prizes and resolves the profile name', () => {
    const summary = summarizeEligibility(
      entry({ eligiblePrizeIds: ['a'], profileId: 'p1' }),
      prizes,
      [{ id: 'p1', name: 'Básico', prizeIds: ['a'] }],
    );
    expect(summary).toEqual({
      label: '🎯 1/2 premios',
      profileName: 'Básico',
      blockedNames: ['Gorra'],
    });
  });

  it('marks deleted profiles without crashing', () => {
    const summary = summarizeEligibility(
      entry({ eligiblePrizeIds: ['a'], profileId: 'ghost' }),
      prizes,
      [],
    );
    expect(summary?.profileName).toBe('perfil eliminado');
  });
});
