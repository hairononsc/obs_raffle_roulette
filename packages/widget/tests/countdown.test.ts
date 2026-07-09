import { describe, expect, it } from 'vitest';

import { formatMmSs, remainingMs } from '../src/offer/countdown.js';

describe('remainingMs', () => {
  it('returns the remaining time and clamps at zero', () => {
    expect(remainingMs(10_000, 4_000)).toBe(6_000);
    expect(remainingMs(10_000, 10_000)).toBe(0);
    expect(remainingMs(10_000, 15_000)).toBe(0);
  });
});

describe('formatMmSs', () => {
  it('formats exact minutes', () => {
    expect(formatMmSs(600_000)).toBe('10:00');
    expect(formatMmSs(60_000)).toBe('01:00');
  });

  it('rounds partial seconds up so the display never skips ahead', () => {
    expect(formatMmSs(599_999)).toBe('10:00');
    expect(formatMmSs(59_001)).toBe('01:00');
    expect(formatMmSs(58_999)).toBe('00:59');
  });

  it('clamps at 00:00 for zero and negative values', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(-5_000)).toBe('00:00');
  });

  it('handles long durations', () => {
    expect(formatMmSs(1_800_000)).toBe('30:00');
  });
});
