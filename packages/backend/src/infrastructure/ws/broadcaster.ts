import {
  createMessage,
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
  }
}

/** Bridges domain events to protocol broadcasts. Returns an unsubscribe fn. */
export function connectBroadcaster(events: EventBus, registry: ConnectionRegistry): () => void {
  return events.subscribe((event) => {
    registry.broadcast(toServerMessage(event));
  });
}
