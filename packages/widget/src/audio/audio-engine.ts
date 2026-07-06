import type { WidgetTheme } from '../theme/theme.js';

export type SoundKey = 'tick' | 'spinStart' | 'winner' | 'confetti';

/**
 * Decoupled audio port: scenes emit intents ("a segment boundary was
 * crossed"), never concrete sounds. What actually plays is decided by the
 * theme's sound manifest and the engine implementation.
 */
export interface AudioEngine {
  play(key: SoundKey): void;
  applyTheme(theme: WidgetTheme): void;
  /** Browsers require a user gesture before audio; OBS does not. */
  unlock(): void;
}
