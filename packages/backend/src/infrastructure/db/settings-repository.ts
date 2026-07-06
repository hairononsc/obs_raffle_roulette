import { SpinSettingsSchema, type SpinSettings } from '@wheellive/shared';
import type { Kysely } from 'kysely';

import { DEFAULT_SPIN_SETTINGS, DEFAULT_THEME_ID } from '../../domain/defaults.js';
import type { SettingsRepository } from '../../application/ports/repositories.js';
import type { Database } from './schema.js';

const SPIN_SETTINGS_KEY = 'spin_settings';
const THEME_ID_KEY = 'theme_id';

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async getSpinSettings(): Promise<SpinSettings> {
    const raw = await this.getValue(SPIN_SETTINGS_KEY);
    if (raw === null) {
      return DEFAULT_SPIN_SETTINGS;
    }
    const parsed = SpinSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SPIN_SETTINGS;
  }

  async setSpinSettings(settings: SpinSettings): Promise<void> {
    await this.setValue(SPIN_SETTINGS_KEY, JSON.stringify(settings));
  }

  async getThemeId(): Promise<string> {
    return (await this.getValue(THEME_ID_KEY)) ?? DEFAULT_THEME_ID;
  }

  async setThemeId(themeId: string): Promise<void> {
    await this.setValue(THEME_ID_KEY, themeId);
  }

  private async getValue(key: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('settings')
      .select('value')
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value ?? null;
  }

  private async setValue(key: string, value: string): Promise<void> {
    await this.db
      .insertInto('settings')
      .values({ key, value })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute();
  }
}
