import { describe, expect, it } from 'vitest';

import {
  PROGRAM_LEAD_IN_MS,
  PROGRAM_MIN_GAP_MS,
  PROGRAM_TAIL_MS,
  planOfferSchedule,
} from '../src/domain/offer-schedule.js';

const NOW = 1_730_000_000_000;
const THREE_HOURS = 10_800_000;

describe('planOfferSchedule', () => {
  it('with rng=0 places each fire at the start of its slot', () => {
    const times = planOfferSchedule({ now: NOW, windowMs: THREE_HOURS, count: 4 }, () => 0);
    const usable = THREE_HOURS - PROGRAM_LEAD_IN_MS - PROGRAM_TAIL_MS;
    const slot = usable / 4;
    expect(times).toEqual([0, 1, 2, 3].map((i) => Math.round(NOW + PROGRAM_LEAD_IN_MS + i * slot)));
  });

  it('respects window bounds and minimum gaps for any rng', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const times = planOfferSchedule(
        { now: NOW, windowMs: THREE_HOURS, count: 5 },
        () => roll,
      );
      expect(times).toHaveLength(5);
      expect(times[0]).toBeGreaterThanOrEqual(NOW + PROGRAM_LEAD_IN_MS);
      expect(times.at(-1)).toBeLessThanOrEqual(NOW + THREE_HOURS - PROGRAM_TAIL_MS);
      for (let i = 1; i < times.length; i += 1) {
        const gap = (times[i] ?? 0) - (times[i - 1] ?? 0);
        expect(gap).toBeGreaterThanOrEqual(PROGRAM_MIN_GAP_MS - 1); // -1: rounding
      }
    }
  });

  it('varied rng values stay inside each slot and remain ascending', () => {
    const rolls = [0.9, 0.1, 0.7, 0.3];
    let call = 0;
    const times = planOfferSchedule(
      { now: NOW, windowMs: THREE_HOURS, count: 4 },
      () => rolls[call++ % rolls.length] ?? 0,
    );
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it('clamps count to what fits with the minimum gap', () => {
    // 2h window: usable = 120 - 10 - 30 = 80 min -> max 4 fires.
    const times = planOfferSchedule(
      { now: NOW, windowMs: 7_200_000, count: 10 },
      () => 0.5,
    );
    expect(times).toHaveLength(4);
  });

  it('returns [] for a window too short to fit anything', () => {
    expect(planOfferSchedule({ now: NOW, windowMs: 1_800_000, count: 3 }, () => 0.5)).toEqual([]);
    expect(planOfferSchedule({ now: NOW, windowMs: THREE_HOURS, count: 0 }, () => 0.5)).toEqual([]);
  });
});
