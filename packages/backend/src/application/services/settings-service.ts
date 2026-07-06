import type { SpinSettings } from '@wheellive/shared';

import type { EventBus } from '../ports/event-bus.js';
import type { UnitOfWork } from '../ports/repositories.js';

export class SettingsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
  ) {}

  async getSpinSettings(): Promise<SpinSettings> {
    return this.uow.run((repos) => repos.settings.getSpinSettings());
  }

  async updateSpinSettings(settings: SpinSettings): Promise<void> {
    await this.uow.run((repos) => repos.settings.setSpinSettings(settings));
    this.events.publish({ kind: 'settings.changed', settings });
  }

  async getThemeId(): Promise<string> {
    return this.uow.run((repos) => repos.settings.getThemeId());
  }

  async setTheme(themeId: string): Promise<void> {
    await this.uow.run((repos) => repos.settings.setThemeId(themeId));
    this.events.publish({ kind: 'theme.changed', themeId });
  }
}
