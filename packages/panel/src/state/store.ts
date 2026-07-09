import type {
  ActiveSpin,
  ChestState,
  FlashOffer,
  OfferProgramState,
  OfferTemplate,
  Prize,
  QueueEntry,
  ServerMessage,
  SpinCompletedMessage,
  SpinSettings,
} from '@wheellive/shared';

import type { ConnectionStatus } from '../net/panel-socket.js';

export interface PanelState {
  status: ConnectionStatus;
  queue: QueueEntry[];
  prizes: Prize[];
  settings: SpinSettings | null;
  themeId: string;
  activeSpin: ActiveSpin | null;
  lastResult: SpinCompletedMessage['payload'] | null;
  chest: ChestState | null;
  flashOffer: FlashOffer | null;
  offerPool: OfferTemplate[];
  offerProgram: OfferProgramState | null;
}

type Listener = (state: PanelState) => void;

/**
 * Single source of truth for the UI. Server broadcasts are the only thing
 * that mutates game data — the panel never applies optimistic updates, so
 * what the operator sees is always what the server confirmed.
 */
export class PanelStore {
  private listeners = new Set<Listener>();

  readonly state: PanelState = {
    status: 'offline',
    queue: [],
    prizes: [],
    settings: null,
    themeId: 'casino',
    activeSpin: null,
    lastResult: null,
    chest: null,
    flashOffer: null,
    offerPool: [],
    offerProgram: null,
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setStatus(status: ConnectionStatus): void {
    this.state.status = status;
    this.notify();
  }

  apply(message: ServerMessage): void {
    switch (message.type) {
      case 'state.sync': {
        const payload = message.payload;
        this.state.queue = payload.queue;
        this.state.prizes = payload.prizes;
        this.state.settings = payload.settings;
        this.state.themeId = payload.themeId;
        this.state.activeSpin = payload.activeSpin;
        this.state.chest = payload.chest;
        this.state.flashOffer = payload.flashOffer;
        this.state.offerPool = payload.offerPool;
        this.state.offerProgram = payload.offerProgram;
        break;
      }
      case 'queue.changed':
        this.state.queue = message.payload.queue;
        break;
      case 'prizes.changed':
        this.state.prizes = message.payload.prizes;
        break;
      case 'settings.changed':
        this.state.settings = message.payload.settings;
        break;
      case 'theme.changed':
        this.state.themeId = message.payload.themeId;
        break;
      case 'wheel.spin.start':
        this.state.activeSpin = message.payload.spin;
        break;
      case 'spin.completed':
        this.state.activeSpin = null;
        this.state.lastResult = message.payload;
        break;
      case 'chest.changed':
        this.state.chest = message.payload.chest;
        break;
      case 'offer.changed':
        this.state.flashOffer = message.payload.offer;
        break;
      case 'offer.pool.changed':
        this.state.offerPool = message.payload.pool;
        break;
      case 'offer.program.changed':
        this.state.offerProgram = message.payload.program;
        break;
      default:
        return;
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

/** Win probability (%) of a prize among currently winnable prizes. */
export function winProbability(prize: Prize, prizes: readonly Prize[]): number | null {
  const eligible = prizes.filter((p) => p.active && (p.stock === null || p.stock > 0));
  const total = eligible.reduce((sum, p) => sum + p.weight, 0);
  const isEligible = eligible.some((p) => p.id === prize.id);
  if (!isEligible || total === 0) {
    return null;
  }
  return (prize.weight / total) * 100;
}
