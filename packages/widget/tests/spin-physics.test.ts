import { describe, expect, it } from 'vitest';

import { TWO_PI, segmentIndexAt } from '../src/wheel/geometry.js';
import { hashToUnit } from '../src/wheel/hash.js';
import { buildSpinTimeline } from '../src/wheel/spin-physics.js';

const ANIMATION = { durationMs: 8000, extraRotations: 5 };

describe('buildSpinTimeline', () => {
  it('always comes to rest inside the target segment', () => {
    for (const segmentCount of [2, 4, 6, 9, 16]) {
      for (let target = 0; target < segmentCount; target += 1) {
        for (const jitter of [0, 0.25, 0.5, 0.75, 0.999]) {
          const timeline = buildSpinTimeline({
            startAngle: 1.234,
            segmentCount,
            targetSegmentIndex: target,
            animation: ANIMATION,
            jitter01: jitter,
          });
          expect(segmentIndexAt(timeline.finalAngle, segmentCount)).toBe(target);
        }
      }
    }
  });

  it('ends exactly at the final angle at t = duration', () => {
    const timeline = buildSpinTimeline({
      startAngle: 0.4,
      segmentCount: 6,
      targetSegmentIndex: 3,
      animation: ANIMATION,
      jitter01: 0.6,
    });
    expect(timeline.angleAt(ANIMATION.durationMs)).toBeCloseTo(timeline.finalAngle, 10);
    expect(timeline.angleAt(ANIMATION.durationMs + 5000)).toBeCloseTo(timeline.finalAngle, 10);
    expect(timeline.isDone(ANIMATION.durationMs)).toBe(true);
    expect(timeline.isDone(ANIMATION.durationMs - 1)).toBe(false);
  });

  it('performs at least the requested extra rotations', () => {
    const timeline = buildSpinTimeline({
      startAngle: 0,
      segmentCount: 8,
      targetSegmentIndex: 5,
      animation: { durationMs: 8000, extraRotations: 7 },
      jitter01: 0.5,
    });
    expect(timeline.finalAngle).toBeGreaterThan(7 * TWO_PI);
  });

  it('is monotonically non-decreasing while travelling (the wheel never reverses mid-spin)', () => {
    const timeline = buildSpinTimeline({
      startAngle: 2.1,
      segmentCount: 6,
      targetSegmentIndex: 1,
      animation: ANIMATION,
      jitter01: 0.3,
    });
    // Main travel phase: strictly forward.
    let previous = timeline.angleAt(0);
    for (let t = 16; t <= ANIMATION.durationMs * 0.9; t += 16) {
      const angle = timeline.angleAt(t);
      expect(angle).toBeGreaterThanOrEqual(previous);
      previous = angle;
    }
  });

  it('overshoots past the final angle and rebounds back (casino bounce)', () => {
    const timeline = buildSpinTimeline({
      startAngle: 0,
      segmentCount: 6,
      targetSegmentIndex: 2,
      animation: ANIMATION,
      jitter01: 0.5,
    });
    const peak = timeline.angleAt(ANIMATION.durationMs * 0.9);
    expect(peak).toBeGreaterThan(timeline.finalAngle);
    expect(timeline.angleAt(ANIMATION.durationMs)).toBeCloseTo(timeline.finalAngle, 10);
  });

  it('is framerate independent: the same instant yields the same angle', () => {
    const build = (): number =>
      buildSpinTimeline({
        startAngle: 1,
        segmentCount: 6,
        targetSegmentIndex: 4,
        animation: ANIMATION,
        jitter01: hashToUnit('spin-abc'),
      }).angleAt(4321);
    expect(build()).toBe(build());
  });
});

describe('hashToUnit', () => {
  it('is deterministic and stays in [0, 1)', () => {
    expect(hashToUnit('spin-123')).toBe(hashToUnit('spin-123'));
    expect(hashToUnit('spin-123')).not.toBe(hashToUnit('spin-124'));
    for (const input of ['a', 'spin-xyz', '🎰', '']) {
      const value = hashToUnit(input);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
