import type { ActiveSpin, Prize, QueueEntry, SpinSettings, WheelSegment } from '@wheellive/shared';

/**
 * Domain events published by application services. Subscribers (the WS
 * broadcaster today; stats, points or rankings tomorrow) react without the
 * services knowing they exist.
 */
export type DomainEvent =
  | { kind: 'queue.changed'; queue: QueueEntry[] }
  | { kind: 'prizes.changed'; prizes: Prize[]; segments: WheelSegment[] }
  | { kind: 'spin.started'; spin: ActiveSpin }
  | {
      kind: 'spin.completed';
      spinId: string;
      buyerName: string;
      prizeId: string;
      prizeName: string;
      completedAt: number;
    }
  | { kind: 'settings.changed'; settings: SpinSettings }
  | { kind: 'theme.changed'; themeId: string };

export type EventHandler = (event: DomainEvent) => void;

export interface EventBus {
  publish(event: DomainEvent): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: EventHandler): () => void;
}
