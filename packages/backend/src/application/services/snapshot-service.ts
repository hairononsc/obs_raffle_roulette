import type { StateSyncMessage } from '@wheellive/shared';

import { computeSegments } from '../../domain/wheel-layout.js';
import type { UnitOfWork } from '../ports/repositories.js';
import type { OfferService } from './offer-service.js';
import type { SpinService } from './spin-service.js';

/**
 * Builds the `state.sync` payload: the complete snapshot from which any
 * client (a freshly reloaded OBS widget included) rebuilds its entire UI.
 */
export class SnapshotService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly spins: SpinService,
    private readonly offers: OfferService,
  ) {}

  async build(): Promise<StateSyncMessage['payload']> {
    return this.uow.run(async (repos) => {
      const prizes = await repos.prizes.list();
      return {
        settings: await repos.settings.getSpinSettings(),
        themeId: await repos.settings.getThemeId(),
        prizes,
        segments: computeSegments(prizes),
        queue: await repos.queue.list(),
        activeSpin: this.spins.getActiveSpin(),
        chest: await repos.settings.getChestState(),
        flashOffer: this.offers.getActive(),
      };
    });
  }
}
