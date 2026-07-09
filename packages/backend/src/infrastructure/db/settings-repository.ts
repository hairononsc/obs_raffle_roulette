import {
  ChestStateSchema,
  FlashOfferSchema,
  SpinSettingsSchema,
  type ChestState,
  type FlashOffer,
  type SpinSettings,
} from '@wheellive/shared';
import type { Kysely } from 'kysely';

import {
  DEFAULT_CHEST_STATE,
  DEFAULT_SPIN_SETTINGS,
  DEFAULT_THEME_ID,
} from '../../domain/defaults.js';
import type { SettingsRepository } from '../../application/ports/repositories.js';
import type { Database } from './schema.js';

const SPIN_SETTINGS_KEY = 'spin_settings';
const THEME_ID_KEY = 'theme_id';
const CHEST_STATE_KEY = 'chest_state';
const FLASH_OFFER_KEY = 'flash_offer_state';

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

  async getChestState(): Promise<ChestState> {
    const raw = await this.getValue(CHEST_STATE_KEY);
    if (raw === null) {
      return DEFAULT_CHEST_STATE;
    }
    const parsed = ChestStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_CHEST_STATE;
  }

  async setChestState(state: ChestState): Promise<void> {
    await this.setValue(CHEST_STATE_KEY, JSON.stringify(state));
  }

  async getFlashOffer(): Promise<FlashOffer | null> {
    const raw = await this.getValue(FLASH_OFFER_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = FlashOfferSchema.nullable().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  }

  async setFlashOffer(offer: FlashOffer | null): Promise<void> {
    await this.setValue(FLASH_OFFER_KEY, JSON.stringify(offer));
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
