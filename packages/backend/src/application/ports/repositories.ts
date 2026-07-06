import type { Prize, QueueEntry, SpinSettings } from '@wheellive/shared';

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
}

export interface SettingsRepository {
  getSpinSettings(): Promise<SpinSettings>;
  setSpinSettings(settings: SpinSettings): Promise<void>;
  getThemeId(): Promise<string>;
  setThemeId(themeId: string): Promise<void>;
}

export interface RepositorySet {
  prizes: PrizeRepository;
  queue: QueueRepository;
  spins: SpinRepository;
  settings: SettingsRepository;
}

/**
 * All repository access goes through a unit of work: `run` executes the
 * callback inside a single database transaction. This is what makes
 * "decide prize + reserve stock + consume spin + persist record" atomic.
 */
export interface UnitOfWork {
  run<T>(work: (repos: RepositorySet) => Promise<T>): Promise<T>;
}
