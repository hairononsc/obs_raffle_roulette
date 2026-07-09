import type { Prize } from '@wheellive/shared';
import { describe, expect, it } from 'vitest';

import { boardProbability, publicRules } from '../src/prizes/board-info.js';

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

describe('publicRules', () => {
  it('open prizes invite everyone', () => {
    expect(publicRules({})).toBe('¡todos participan!');
  });

  it('renders customer-facing text for common rules', () => {
    expect(publicRules({ minPurchase: 750, maxPerDay: 1 })).toBe(
      'compra mín. RD$750 · máx 1 por live',
    );
    expect(publicRules({ requiresActiveOffer: true })).toBe('solo durante ofertas ⚡');
    expect(publicRules({ daysOfWeek: [5, 6], hourStart: 18, hourEnd: 22 })).toBe(
      'solo V·S · de 6pm a 10pm',
    );
  });

  it('omits internal-only conditions', () => {
    expect(publicRules({ requiresApproval: true })).toBe('¡todos participan!');
  });
});

describe('boardProbability', () => {
  const light = prize({ id: 'a', weight: 1 });
  const heavy = prize({ id: 'b', weight: 3 });
  const soldOut = prize({ id: 'agotado', weight: 6, stock: 0 });
  const catalog = [light, heavy, soldOut];

  it('computes % among winnable prizes only', () => {
    expect(boardProbability(light, catalog)).toBeCloseTo(25);
    expect(boardProbability(heavy, catalog)).toBeCloseTo(75);
  });

  it('returns null for prizes that cannot be won', () => {
    expect(boardProbability(soldOut, catalog)).toBeNull();
  });
});
