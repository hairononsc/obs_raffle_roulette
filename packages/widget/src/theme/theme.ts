import { z } from 'zod';

export const SoundSpecSchema = z.union([
  z.object({ type: z.literal('synth'), preset: z.string().min(1) }),
  z.object({ type: z.literal('file'), src: z.string().min(1) }),
]);

export type SoundSpec = z.infer<typeof SoundSpecSchema>;

/**
 * Visual + audio resources for one theme. Themes never change behaviour —
 * only looks and sounds. Every field is optional in a `theme.json`; missing
 * values fall back to the built-in casino theme.
 */
export const ThemeSchema = z.object({
  id: z.string().min(1),
  glowColor: z.string().min(1),
  wheel: z.object({
    rimColor: z.string().min(1),
    lightOnColor: z.string().min(1),
    lightOffColor: z.string().min(1),
    lightCount: z.number().int().min(8).max(64),
    hubColor: z.string().min(1),
    hubAccentColor: z.string().min(1),
    strokeColor: z.string().min(1),
    labelColor: z.string().min(1),
  }),
  pointer: z.object({
    color: z.string().min(1),
    strokeColor: z.string().min(1),
  }),
  banner: z.object({
    nameColor: z.string().min(1),
    accentColor: z.string().min(1),
  }),
  confettiColors: z.array(z.string().min(1)).min(2),
  /** Maps prize `icon` keys to display glyphs (emoji or single chars). */
  icons: z.record(z.string()),
  iconFallback: z.string().min(1),
  sounds: z.record(SoundSpecSchema),
});

export type WidgetTheme = z.infer<typeof ThemeSchema>;

/**
 * Resolves a prize `icon` to a display glyph. Theme keys (`prize-*`) go
 * through the theme's icon map with the theme fallback; anything else is
 * treated as a literal glyph (e.g. an emoji typed straight into the panel).
 */
export function resolveIcon(theme: WidgetTheme, icon: string): string {
  const mapped = theme.icons[icon];
  if (mapped !== undefined) {
    return mapped;
  }
  return icon.startsWith('prize-') ? theme.iconFallback : icon;
}

export const CASINO_THEME: WidgetTheme = {
  id: 'casino',
  glowColor: '#f5c542',
  wheel: {
    rimColor: '#2b1a0e',
    lightOnColor: '#ffe08a',
    lightOffColor: '#6b5537',
    lightCount: 24,
    hubColor: '#1d1207',
    hubAccentColor: '#f5c542',
    strokeColor: '#14100b',
    labelColor: '#ffffff',
  },
  pointer: {
    color: '#f5c542',
    strokeColor: '#3a2c12',
  },
  banner: {
    nameColor: '#ffffff',
    accentColor: '#f5c542',
  },
  confettiColors: ['#f5c542', '#e63946', '#2a9d8f', '#457b9d', '#ffffff', '#e9c46a'],
  icons: {
    'prize-jeans': '👖',
    'prize-discount': '🏷️',
    'prize-shipping': '📦',
    'prize-cap': '🧢',
    'prize-gift': '🎁',
    'prize-respin': '🔄',
    'prize-vip': '⭐',
    'prize-coupon': '🎊',
    'prize-accessory': '🌸',
    'prize-live-price': '🔥',
    'prize-extra-spin': '🎯',
    'prize-priority': '✨',
    'prize-surprise': '💎',
  },
  iconFallback: '🎁',
  sounds: {
    tick: { type: 'synth', preset: 'tick' },
    spinStart: { type: 'synth', preset: 'whoosh' },
    winner: { type: 'synth', preset: 'fanfare' },
    confetti: { type: 'synth', preset: 'sparkle' },
  },
};
