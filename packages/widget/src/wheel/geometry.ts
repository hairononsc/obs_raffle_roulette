/**
 * Pure wheel geometry. Pixi convention: angle 0 = +X axis, positive =
 * clockwise (Y axis points down). The pointer sits at the top of the wheel.
 * Segment i occupies the local arc [i*arc, (i+1)*arc).
 */

export const TWO_PI = Math.PI * 2;

/** World angle of the pointer (12 o'clock). */
export const POINTER_ANGLE = -Math.PI / 2;

export function segmentArc(segmentCount: number): number {
  return TWO_PI / segmentCount;
}

/** Normalizes any angle into [0, 2π). */
export function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Local angle of the center of segment `index`. */
export function segmentCenterAngle(index: number, segmentCount: number): number {
  return (index + 0.5) * segmentArc(segmentCount);
}

/** Wheel rotation (mod 2π) that rests segment `index` under the pointer. */
export function restAngleForSegment(index: number, segmentCount: number): number {
  return normalizeAngle(POINTER_ANGLE - segmentCenterAngle(index, segmentCount));
}

/**
 * Positive rotation needed to travel clockwise from `startAngle` to the
 * rest position of segment `index`. Never returns 0: an exact hit still
 * makes a full turn so a spin is always visible.
 */
export function targetRotationDelta(
  startAngle: number,
  index: number,
  segmentCount: number,
): number {
  const delta = normalizeAngle(restAngleForSegment(index, segmentCount) - startAngle);
  return delta === 0 ? TWO_PI : delta;
}

/** Which segment is currently under the pointer for a given wheel rotation. */
export function segmentIndexAt(rotation: number, segmentCount: number): number {
  const local = normalizeAngle(POINTER_ANGLE - rotation);
  return Math.min(segmentCount - 1, Math.floor(local / segmentArc(segmentCount)));
}
