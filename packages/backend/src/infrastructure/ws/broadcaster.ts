import {
  createMessage,
  type ChestChangedMessage,
  type OfferChangedMessage,
  type OfferPoolChangedMessage,
  type OfferProgramChangedMessage,
  type ProfilesChangedMessage,
  type PrizesChangedMessage,
  type QueueChangedMessage,
  type ServerMessage,
  type SettingsChangedMessage,
  type SpinCompletedMessage,
  type SpinStartMessage,
  type ThemeChangedMessage,
} from '@wheellive/shared';

import type { DomainEvent, EventBus } from '../../application/ports/event-bus.js';
import type { ConnectionRegistry } from './connection-registry.js';

function toServerMessage(event: DomainEvent): ServerMessage {
  switch (event.kind) {
    case 'queue.changed':
      return createMessage<QueueChangedMessage>('queue.changed', { queue: event.queue });
    case 'prizes.changed':
      return createMessage<PrizesChangedMessage>('prizes.changed', {
        prizes: event.prizes,
        segments: event.segments,
      });
    case 'spin.started':
      return createMessage<SpinStartMessage>('wheel.spin.start', { spin: event.spin });
    case 'spin.completed':
      return createMessage<SpinCompletedMessage>('spin.completed', {
        spinId: event.spinId,
        buyerName: event.buyerName,
        prizeId: event.prizeId,
        prizeName: event.prizeName,
        completedAt: event.completedAt,
      });
    case 'settings.changed':
      return createMessage<SettingsChangedMessage>('settings.changed', {
        settings: event.settings,
      });
    case 'theme.changed':
      return createMessage<ThemeChangedMessage>('theme.changed', { themeId: event.themeId });
    case 'chest.changed':
      return createMessage<ChestChangedMessage>('chest.changed', {
        chest: event.chest,
        cause: event.cause,
      });
    case 'offer.changed':
      return createMessage<OfferChangedMessage>('offer.changed', {
        offer: event.offer,
        cause: event.cause,
      });
    case 'profiles.changed':
      return createMessage<ProfilesChangedMessage>('profiles.changed', {
        profiles: event.profiles,
      });
    case 'offer.pool.changed':
      return createMessage<OfferPoolChangedMessage>('offer.pool.changed', { pool: event.pool });
    case 'offer.program.changed':
      return createMessage<OfferProgramChangedMessage>('offer.program.changed', {
        program: event.program,
        cause: event.cause,
      });
  }
}

/** Bridges domain events to protocol broadcasts. Returns an unsubscribe fn. */
export function connectBroadcaster(events: EventBus, registry: ConnectionRegistry): () => void {
  return events.subscribe((event) => {
    registry.broadcast(toServerMessage(event));
  });
}
