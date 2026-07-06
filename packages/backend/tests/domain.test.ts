import { describe, expect, it } from 'vitest';

import { selectPrize } from '../src/domain/prize-selection.js';
import { createSpinAnimation } from '../src/domain/spin-animation.js';
import { assertTransition, canTransition } from '../src/domain/spin-lifecycle.js';
import { computeSegments } from '../src/domain/wheel-layout.js';
import { testPrize } from './helpers.js';

describe('selectPrize', () => {
  const prizes = [
    testPrize({ id: 'a', weight: 1 }),
    testPrize({ id: 'b', weight: 3 }),
    testPrize({ id: 'c', weight: 6 }),
  ];

  it('respects weights: low roll hits the first prize, high roll the last', () => {
    expect(selectPrize(prizes, () => 0.05)?.id).toBe('a'); // 0.5 of 10 < 1
    expect(selectPrize(prizes, () => 0.2)?.id).toBe('b'); // 2 of 10 in (1, 4]
    expect(selectPrize(prizes, () => 0.99)?.id).toBe('c'); // 9.9 of 10 > 4
  });

  it('never selects inactive prizes or prizes with stock 0', () => {
    const constrained = [
      testPrize({ id: 'inactive', weight: 100, active: false }),
      testPrize({ id: 'depleted', weight: 100, stock: 0 }),
      testPrize({ id: 'available', weight: 1, stock: 2 }),
    ];
    for (const roll of [0, 0.5, 0.999]) {
      expect(selectPrize(constrained, () => roll)?.id).toBe('available');
    }
  });

  it('returns null when nothing is eligible', () => {
    expect(selectPrize([testPrize({ id: 'x', stock: 0 })], () => 0.5)).toBeNull();
    expect(selectPrize([], () => 0.5)).toBeNull();
  });

  it('handles a roll of exactly the total weight (floating point edge)', () => {
    expect(selectPrize(prizes, () => 0.9999999999999999)?.id).toBe('c');
  });
});

describe('computeSegments', () => {
  it('keeps active prizes with stock 0 on the wheel but drops inactive ones', () => {
    const segments = computeSegments([
      testPrize({ id: 'a' }),
      testPrize({ id: 'b', active: false }),
      testPrize({ id: 'c', stock: 0 }),
    ]);
    expect(segments.map((segment) => segment.prizeId)).toEqual(['a', 'c']);
    expect(segments.map((segment) => segment.index)).toEqual([0, 1]);
  });
});

describe('spin lifecycle', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('spinning', 'celebrating')).toBe(true);
    expect(canTransition('spinning', 'completed')).toBe(true);
    expect(canTransition('celebrating', 'completed')).toBe(true);
    expect(canTransition('celebrating', 'spinning')).toBe(false);
    expect(canTransition('completed', 'spinning')).toBe(false);
    expect(() => {
      assertTransition('completed', 'celebrating');
    }).toThrowError(/illegal spin transition/);
  });
});

describe('createSpinAnimation', () => {
  const settings = { durationMs: 8000, extraRotations: { min: 4, max: 7 } };

  it('stays inside the configured range at both extremes', () => {
    expect(createSpinAnimation(settings, () => 0).extraRotations).toBe(4);
    expect(createSpinAnimation(settings, () => 0.999).extraRotations).toBe(7);
    expect(createSpinAnimation(settings, () => 0).durationMs).toBe(8000);
  });
});
