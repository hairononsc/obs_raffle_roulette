import type { ChestState, SpinSettings } from '@wheellive/shared';

export const DEFAULT_SPIN_SETTINGS: SpinSettings = {
  durationMs: 8000,
  extraRotations: { min: 4, max: 7 },
};

export const DEFAULT_THEME_ID = 'casino';

export const DEFAULT_CHEST_STATE: ChestState = {
  keys: 0,
  keysTarget: 5,
  prize: '🎁 Premio Sorpresa',
  status: 'locked',
};
