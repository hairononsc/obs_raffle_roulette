import { CASINO_THEME, ThemeSchema, type WidgetTheme } from './theme.js';

/**
 * Loads `/themes/<id>/theme.json`. A theme file may be partial: it is
 * deep-merged over the built-in casino theme, and an invalid or missing
 * file falls back to casino entirely — a bad theme must never blank the
 * stream overlay.
 */
export async function loadTheme(themeId: string): Promise<WidgetTheme> {
  if (themeId === CASINO_THEME.id) {
    return CASINO_THEME;
  }
  try {
    // Relative path: resolves to /themes/ on the Vite dev server and to
    // /widget/themes/ when the backend serves the built widget.
    const response = await fetch(`themes/${encodeURIComponent(themeId)}/theme.json`);
    if (!response.ok) {
      console.warn(`[theme] "${themeId}" not found (${String(response.status)}), using casino`);
      return CASINO_THEME;
    }
    const raw: unknown = await response.json();
    const merged = mergeTheme(raw, themeId);
    const parsed = ThemeSchema.safeParse(merged);
    if (!parsed.success) {
      console.warn(`[theme] "${themeId}" is invalid, using casino`, parsed.error.issues);
      return CASINO_THEME;
    }
    return parsed.data;
  } catch (error) {
    console.warn(`[theme] failed to load "${themeId}", using casino`, error);
    return CASINO_THEME;
  }
}

function mergeTheme(raw: unknown, themeId: string): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return CASINO_THEME;
  }
  const partial = raw as Record<string, unknown>;
  return {
    ...CASINO_THEME,
    ...partial,
    id: themeId,
    wheel: { ...CASINO_THEME.wheel, ...asObject(partial.wheel) },
    pointer: { ...CASINO_THEME.pointer, ...asObject(partial.pointer) },
    banner: { ...CASINO_THEME.banner, ...asObject(partial.banner) },
    chest: { ...CASINO_THEME.chest, ...asObject(partial.chest) },
    offer: { ...CASINO_THEME.offer, ...asObject(partial.offer) },
    icons: { ...CASINO_THEME.icons, ...asObject(partial.icons) },
    sounds: { ...CASINO_THEME.sounds, ...asObject(partial.sounds) },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
