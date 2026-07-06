import type { Prize, WheelSegment } from '@wheellive/shared';

/**
 * Derives the wheel layout from the prize list (already in stable creation
 * order). Active prizes stay on the wheel even at stock 0 — the layout does
 * not reshuffle mid-show; they simply can never be selected. Deactivating a
 * prize is the deliberate operator action that removes its segment.
 */
export function computeSegments(prizes: readonly Prize[]): WheelSegment[] {
  return prizes
    .filter((prize) => prize.active)
    .map((prize, index) => ({
      index,
      prizeId: prize.id,
      label: prize.name,
      color: prize.color,
      icon: prize.icon,
    }));
}
