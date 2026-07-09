import type {
  ChestState,
  Customer,
  FlashOffer,
  OfferProgramState,
  OfferTemplate,
  Prize,
  QueueEntry,
  SpinSettings,
  WheelProfile,
} from '@wheellive/shared';

import type { HistoryPage, SpinStats } from '../../domain/history.js';
import type { SpinStatus } from '../../domain/spin-lifecycle.js';
import type { SpinRecord } from '../../domain/spin-record.js';

export interface PrizeRepository {
  /** All prizes (including inactive), in stable creation order. */
  list(): Promise<Prize[]>;
  findById(id: string): Promise<Prize | null>;
  create(prize: Prize, createdAt: number): Promise<void>;
  update(prize: Prize): Promise<void>;
  /** Returns false when the prize did not exist. */
  remove(id: string): Promise<boolean>;
  /** Reserves one unit. Throws if stock was already 0 (guarded by selection). */
  decrementStock(id: string): Promise<void>;
}

export interface QueueRepository {
  /** Entries with spins remaining, oldest first. */
  list(): Promise<QueueEntry[]>;
  findById(id: string): Promise<QueueEntry | null>;
  create(entry: QueueEntry): Promise<void>;
  decrementRemaining(id: string): Promise<void>;
  /** Returns false when the entry did not exist. */
  remove(id: string): Promise<boolean>;
}

export interface SpinRepository {
  create(record: SpinRecord): Promise<void>;
  updateStatus(spinId: string, status: SpinStatus, completedAt: number | null): Promise<void>;
  /** Marks every non-completed spin as completed (crash recovery on boot). */
  completeAllUnfinished(completedAt: number): Promise<number>;
  history(limit: number, offset: number): Promise<HistoryPage>;
  stats(): Promise<SpinStats>;
  /** Awards per prize since each boundary (any status, by started_at). */
  countAwardsByPrize(since: {
    day: number;
    week: number;
    month: number;
  }): Promise<Record<string, { day: number; week: number; month: number }>>;
  /** Total awards per prize for one customer (any status). */
  countAwardsByCustomer(customerId: string): Promise<Record<string, number>>;
}

export interface CustomerRepository {
  findByNormalizedName(normalizedName: string): Promise<Customer | null>;
  create(customer: Customer): Promise<void>;
  /** Sets the phone only if the customer had none. */
  setPhone(id: string, phone: string): Promise<void>;
}

export interface SettingsRepository {
  getSpinSettings(): Promise<SpinSettings>;
  setSpinSettings(settings: SpinSettings): Promise<void>;
  getThemeId(): Promise<string>;
  setThemeId(themeId: string): Promise<void>;
  getChestState(): Promise<ChestState>;
  setChestState(state: ChestState): Promise<void>;
  getFlashOffer(): Promise<FlashOffer | null>;
  setFlashOffer(offer: FlashOffer | null): Promise<void>;
  getOfferPool(): Promise<OfferTemplate[]>;
  setOfferPool(pool: OfferTemplate[]): Promise<void>;
  getOfferProgram(): Promise<OfferProgramState | null>;
  setOfferProgram(state: OfferProgramState | null): Promise<void>;
  getWheelProfiles(): Promise<WheelProfile[]>;
  setWheelProfiles(profiles: WheelProfile[]): Promise<void>;
}

export interface RepositorySet {
  prizes: PrizeRepository;
  queue: QueueRepository;
  spins: SpinRepository;
  settings: SettingsRepository;
  customers: CustomerRepository;
}

/**
 * All repository access goes through a unit of work: `run` executes the
 * callback inside a single database transaction. This is what makes
 * "decide prize + reserve stock + consume spin + persist record" atomic.
 */
export interface UnitOfWork {
  run<T>(work: (repos: RepositorySet) => Promise<T>): Promise<T>;
}
