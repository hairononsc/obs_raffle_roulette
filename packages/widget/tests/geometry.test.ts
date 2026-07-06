import { describe, expect, it } from 'vitest';

import {
  TWO_PI,
  normalizeAngle,
  restAngleForSegment,
  segmentIndexAt,
  targetRotationDelta,
} from '../src/wheel/geometry.js';

describe('normalizeAngle', () => {
  it('maps any angle into [0, 2π)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(TWO_PI)).toBe(0);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeAngle(5 * TWO_PI + 0.3)).toBeCloseTo(0.3);
  });
});

describe('restAngleForSegment / segmentIndexAt round trip', () => {
  it('the rest angle of every segment puts that segment under the pointer', () => {
    for (const count of [2, 3, 6, 8, 12, 24]) {
      for (let index = 0; index < count; index += 1) {
        const rest = restAngleForSegment(index, count);
        expect(segmentIndexAt(rest, count)).toBe(index);
      }
    }
  });
});

describe('targetRotationDelta', () => {
  it('is always a positive clockwise rotation', () => {
    for (const start of [0, 1.3, 4.5, -2]) {
      for (let index = 0; index < 6; index += 1) {
        const delta = targetRotationDelta(start, index, 6);
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThanOrEqual(TWO_PI);
      }
    }
  });

  it('makes a full turn instead of not moving on an exact hit', () => {
    const rest = restAngleForSegment(2, 6);
    expect(targetRotationDelta(rest, 2, 6)).toBeCloseTo(TWO_PI);
  });
});
