import type {
  ActiveSpin,
  ChestChangedMessage,
  ChestState,
  FlashOffer,
  OfferChangedMessage,
  OfferProgramChangedMessage,
  OfferProgramState,
  OfferTemplate,
  Prize,
  QueueEntry,
  SpinSettings,
  WheelProfile,
  WheelSegment,
} from '@wheellive/shared';

export type ChestChangeCause = ChestChangedMessage['payload']['cause'];
export type OfferChangeCause = OfferChangedMessage['payload']['cause'];
export type OfferProgramChangeCause = OfferProgramChangedMessage['payload']['cause'];

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
  | { kind: 'theme.changed'; themeId: string }
  | { kind: 'chest.changed'; chest: ChestState; cause: ChestChangeCause }
  | { kind: 'offer.changed'; offer: FlashOffer | null; cause: OfferChangeCause }
  | { kind: 'profiles.changed'; profiles: WheelProfile[] }
  | { kind: 'offer.pool.changed'; pool: OfferTemplate[] }
  | {
      kind: 'offer.program.changed';
      program: OfferProgramState | null;
      cause: OfferProgramChangeCause;
    };

export type EventHandler = (event: DomainEvent) => void;

export interface EventBus {
  publish(event: DomainEvent): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: EventHandler): () => void;
}
