import type { ClientMessage, ClientRole } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import type { ChestService } from '../../application/services/chest-service.js';
import type { OfferProgramService } from '../../application/services/offer-program-service.js';
import type { OfferService } from '../../application/services/offer-service.js';
import type { PrizeService } from '../../application/services/prize-service.js';
import type { QueueService } from '../../application/services/queue-service.js';
import type { SettingsService } from '../../application/services/settings-service.js';
import type { SpinService } from '../../application/services/spin-service.js';

const ROLE_PERMISSIONS: Record<ClientRole, ReadonlySet<ClientMessage['type']>> = {
  panel: new Set([
    'queue.add',
    'queue.remove',
    'spin.launch',
    'prize.create',
    'prize.update',
    'prize.delete',
    'settings.update',
    'theme.set',
    'chest.key.add',
    'chest.key.remove',
    'chest.open',
    'chest.close',
    'chest.reset',
    'chest.configure',
    'offer.start',
    'offer.cancel',
    'offer.pool.add',
    'offer.pool.remove',
    'offer.program.start',
    'offer.program.stop',
  ]),
  widget: new Set(['wheel.spin.landed']),
};

export interface DispatcherServices {
  queue: QueueService;
  prizes: PrizeService;
  settings: SettingsService;
  spins: SpinService;
  chest: ChestService;
  offers: OfferService;
  offerProgram: OfferProgramService;
}

/** Routes an authenticated client message to the right application service. */
export class CommandDispatcher {
  constructor(private readonly services: DispatcherServices) {}

  async dispatch(message: ClientMessage, role: ClientRole): Promise<void> {
    if (message.type === 'hello') {
      throw new DomainError('INVALID_STATE', 'connection is already authenticated');
    }
    if (!ROLE_PERMISSIONS[role].has(message.type)) {
      throw new DomainError('FORBIDDEN', `role "${role}" cannot send "${message.type}"`);
    }

    switch (message.type) {
      case 'queue.add': {
        const { buyerName, spins, note } = message.payload;
        await this.services.queue.add({
          buyerName,
          spins,
          ...(note !== undefined && { note }),
        });
        return;
      }
      case 'queue.remove':
        await this.services.queue.remove(message.payload.entryId);
        return;
      case 'spin.launch':
        await this.services.spins.launch(message.payload.entryId);
        return;
      case 'wheel.spin.landed':
        await this.services.spins.confirmLanded(message.payload.spinId);
        return;
      case 'prize.create':
        await this.services.prizes.create(message.payload.prize);
        return;
      case 'prize.update':
        await this.services.prizes.update(
          message.payload.prizeId,
          // JSON cannot carry `undefined`, but zod's Partial<> type allows
          // it; strip it so exact-optional domain types stay clean.
          Object.fromEntries(
            Object.entries(message.payload.patch).filter(([, value]) => value !== undefined),
          ),
        );
        return;
      case 'prize.delete':
        await this.services.prizes.remove(message.payload.prizeId);
        return;
      case 'settings.update':
        await this.services.settings.updateSpinSettings(message.payload.settings);
        return;
      case 'theme.set':
        await this.services.settings.setTheme(message.payload.themeId);
        return;
      case 'chest.key.add':
        await this.services.chest.addKey();
        return;
      case 'chest.key.remove':
        await this.services.chest.removeKey();
        return;
      case 'chest.open':
        await this.services.chest.open();
        return;
      case 'chest.close':
        await this.services.chest.close();
        return;
      case 'chest.reset':
        await this.services.chest.reset();
        return;
      case 'chest.configure':
        await this.services.chest.configure(message.payload);
        return;
      case 'offer.start':
        await this.services.offers.start(message.payload);
        return;
      case 'offer.cancel':
        await this.services.offers.cancel();
        return;
      case 'offer.pool.add':
        await this.services.offerProgram.addTemplate(message.payload.template);
        return;
      case 'offer.pool.remove':
        await this.services.offerProgram.removeTemplate(message.payload.templateId);
        return;
      case 'offer.program.start':
        await this.services.offerProgram.start(message.payload);
        return;
      case 'offer.program.stop':
        await this.services.offerProgram.stop();
        return;
    }
  }
}
