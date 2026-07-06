import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const EnvSchema = z.object({
  WHEELLIVE_HOST: z.string().min(1).default('127.0.0.1'),
  WHEELLIVE_PORT: z.coerce.number().int().min(0).max(65535).default(8710),
  WHEELLIVE_PANEL_TOKEN: z.string().min(1).default('dev-token'),
  WHEELLIVE_DB_PATH: z.string().min(1).default('data/wheellive.sqlite'),
  WHEELLIVE_LANDING_GRACE_MS: z.coerce.number().int().min(0).default(5000),
  WHEELLIVE_CELEBRATION_MS: z.coerce.number().int().min(0).default(6000),
  WHEELLIVE_WIDGET_DIST: z.string().min(1).optional(),
  WHEELLIVE_PANEL_DIST: z.string().min(1).optional(),
});

// This file lives at src/config.ts (dev) or dist/config.js (build); one
// level up is the backend package root either way.
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface SpinTiming {
  /** Extra time past the animation before the server force-completes a spin. */
  landingGraceMs: number;
  /** How long the celebration lasts after the widget confirms the landing. */
  celebrationMs: number;
}

export interface StaticConfig {
  /** Built widget to serve at /widget/ — null disables the mount. */
  widgetDist: string | null;
  /** Built panel to serve at /panel/ — null disables the mount. */
  panelDist: string | null;
}

export interface AppConfig {
  host: string;
  port: number;
  panelToken: string;
  dbPath: string;
  timing: SpinTiming;
  static: StaticConfig;
}

export const DEFAULT_PANEL_TOKEN = 'dev-token';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  return {
    host: parsed.WHEELLIVE_HOST,
    port: parsed.WHEELLIVE_PORT,
    panelToken: parsed.WHEELLIVE_PANEL_TOKEN,
    dbPath: parsed.WHEELLIVE_DB_PATH,
    timing: {
      landingGraceMs: parsed.WHEELLIVE_LANDING_GRACE_MS,
      celebrationMs: parsed.WHEELLIVE_CELEBRATION_MS,
    },
    static: {
      widgetDist: parsed.WHEELLIVE_WIDGET_DIST ?? join(PACKAGE_ROOT, '..', 'widget', 'dist'),
      panelDist: parsed.WHEELLIVE_PANEL_DIST ?? join(PACKAGE_ROOT, '..', 'panel', 'dist'),
    },
  };
}
