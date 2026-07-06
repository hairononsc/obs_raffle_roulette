import type { SpinAnimation } from '@wheellive/shared';

import { TWO_PI, segmentArc, targetRotationDelta } from './geometry.js';

/**
 * Deterministic spin curve. Three phases inside one fixed duration:
 *
 *   1. acceleration (quadratic ramp)          ┐
 *   2. deceleration (cubic ease-out), C1-     ├─ MAIN_PORTION of duration,
 *      continuous with phase 1                ┘  overshoots the target
 *   3. settle: eases back from the overshoot to the exact rest pose
 *      (the casino-style "rebound")
 *
 * The curve is a pure function of elapsed time, so any framerate — OBS at
 * 30, 48 or 60 FPS — lands on the same angle at the same moment, and a
 * reloaded widget can resume mid-spin from the server's timestamps.
 */

/** Fraction of the duration used by phases 1+2 (the rest is the rebound). */
const MAIN_PORTION = 0.9;
/** Fraction of the main phase spent accelerating. */
const ACCEL_PORTION = 0.22;
/** Overshoot size relative to one segment arc. */
const OVERSHOOT_ARC_FRACTION = 0.25;
/** Max distance from the segment center at rest, relative to the arc.
 *  Must stay < 0.5 so the wheel always rests inside the target segment. */
const JITTER_ARC_FRACTION = 0.35;

export interface SpinTimeline {
  durationMs: number;
  finalAngle: number;
  angleAt(elapsedMs: number): number;
  isDone(elapsedMs: number): boolean;
}

export interface SpinTimelineOptions {
  startAngle: number;
  segmentCount: number;
  targetSegmentIndex: number;
  animation: SpinAnimation;
  /** Deterministic value in [0, 1) — derive it from the spinId. */
  jitter01: number;
}

/**
 * Piecewise accelerate-then-decelerate easing, C1-continuous at the joint:
 * f(0)=0, f(1)=1, f'(1)=0. Constants solved from the continuity equations.
 */
function mainEase(accelPortion: number): (x: number) => number {
  const p = accelPortion;
  const a = 1 / ((1 - p) ** 2 * (1 + p / 2));
  const c = (3 * a * (1 - p) ** 2) / (2 * p);
  return (x) => (x < p ? c * x * x : 1 - a * (1 - x) ** 3);
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

export function buildSpinTimeline(options: SpinTimelineOptions): SpinTimeline {
  const { startAngle, segmentCount, targetSegmentIndex, animation, jitter01 } = options;
  const arc = segmentArc(segmentCount);

  const jitter = (jitter01 * 2 - 1) * JITTER_ARC_FRACTION * arc;
  const travel =
    targetRotationDelta(startAngle, targetSegmentIndex, segmentCount) +
    animation.extraRotations * TWO_PI +
    jitter;
  const overshoot = Math.min(arc * OVERSHOOT_ARC_FRACTION, travel * 0.05);
  const ease = mainEase(ACCEL_PORTION);
  const durationMs = animation.durationMs;
  const finalAngle = startAngle + travel;

  return {
    durationMs,
    finalAngle,
    angleAt(elapsedMs: number): number {
      const t = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
      if (t <= MAIN_PORTION) {
        return startAngle + (travel + overshoot) * ease(t / MAIN_PORTION);
      }
      const x = (t - MAIN_PORTION) / (1 - MAIN_PORTION);
      return finalAngle + overshoot * (1 - easeInOutQuad(x));
    },
    isDone(elapsedMs: number): boolean {
      return elapsedMs >= durationMs;
    },
  };
}
