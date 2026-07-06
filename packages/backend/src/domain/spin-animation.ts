import type { SpinAnimation, SpinSettings } from '@wheellive/shared';

/**
 * Draws concrete animation parameters for one spin. `extraRotations` is
 * picked uniformly within the configured range so consecutive spins do not
 * look identical on stream.
 */
export function createSpinAnimation(settings: SpinSettings, random: () => number): SpinAnimation {
  const { min, max } = settings.extraRotations;
  const extraRotations = min + Math.floor(random() * (max - min + 1));
  return {
    durationMs: settings.durationMs,
    extraRotations: Math.min(extraRotations, max),
  };
}
