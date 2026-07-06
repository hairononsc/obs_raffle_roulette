import type { Prize } from '@wheellive/shared';

/** A prize can be won only while it is active and has stock left. */
export function isEligible(prize: Prize): boolean {
  return prize.active && (prize.stock === null || prize.stock > 0);
}

/**
 * Weighted random selection among eligible prizes. `random` must return a
 * value in [0, 1). Returns `null` when no prize is eligible — the caller
 * must refuse to launch the spin in that case.
 */
export function selectPrize(prizes: readonly Prize[], random: () => number): Prize | null {
  const eligible = prizes.filter(isEligible);
  if (eligible.length === 0) {
    return null;
  }

  const totalWeight = eligible.reduce((sum, prize) => sum + prize.weight, 0);
  let threshold = random() * totalWeight;
  for (const prize of eligible) {
    threshold -= prize.weight;
    if (threshold < 0) {
      return prize;
    }
  }
  // Floating-point accumulation can leave threshold at exactly 0.
  return eligible[eligible.length - 1] ?? null;
}
