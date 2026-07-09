import type { ChestState } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import type { ChestChangeCause, EventBus } from '../ports/event-bus.js';
import type { UnitOfWork } from '../ports/repositories.js';

/**
 * Owns the live chest: keys accumulate until `keysTarget`, which unlocks
 * the chest and reveals the prize. State lives in the key-value settings
 * store (no in-memory cache — mutations are rare and this way every change
 * survives a restart for free).
 */
export class ChestService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
  ) {}

  async get(): Promise<ChestState> {
    return this.uow.run((repos) => repos.settings.getChestState());
  }

  async addKey(): Promise<void> {
    await this.mutate('keyAdded', (chest) => {
      this.assertLocked(chest, 'cannot add a key to an unlocked chest');
      const keys = Math.min(chest.keys + 1, chest.keysTarget);
      const status = keys >= chest.keysTarget ? 'unlocked' : 'locked';
      return { ...chest, keys, status };
    });
  }

  async removeKey(): Promise<void> {
    await this.mutate('keyRemoved', (chest) => {
      this.assertLocked(chest, 'cannot remove a key from an unlocked chest');
      return { ...chest, keys: Math.max(chest.keys - 1, 0) };
    });
  }

  /** Manual open, regardless of key count. Idempotent: opening an already
   *  unlocked chest acks without broadcasting (no replayed animation). */
  async open(): Promise<void> {
    await this.mutate('opened', (chest) =>
      chest.status === 'unlocked' ? null : { ...chest, status: 'unlocked' },
    );
  }

  /** Back to locked, keeping the keys — the operator decides when to reset. */
  async close(): Promise<void> {
    await this.mutate('closed', (chest) =>
      chest.status === 'locked' ? null : { ...chest, status: 'locked' },
    );
  }

  async reset(): Promise<void> {
    await this.mutate('reset', (chest) => ({ ...chest, keys: 0, status: 'locked' }));
  }

  /** Reconfigure prize and target. Never auto-unlocks: even if the clamped
   *  key count now equals the target, unlocking happens only via addKey/open. */
  async configure(input: { prize: string; keysTarget: number }): Promise<void> {
    await this.mutate('configured', (chest) => ({
      ...chest,
      prize: input.prize,
      keysTarget: input.keysTarget,
      keys: Math.min(chest.keys, input.keysTarget),
    }));
  }

  /** Reads, transforms and persists in one transaction, then broadcasts.
   *  A `null` from the transform means no-op (ack without broadcast). */
  private async mutate(
    cause: ChestChangeCause,
    transform: (chest: ChestState) => ChestState | null,
  ): Promise<void> {
    const next = await this.uow.run(async (repos) => {
      const updated = transform(await repos.settings.getChestState());
      if (updated !== null) {
        await repos.settings.setChestState(updated);
      }
      return updated;
    });
    if (next !== null) {
      this.events.publish({ kind: 'chest.changed', chest: next, cause });
    }
  }

  private assertLocked(chest: ChestState, message: string): void {
    if (chest.status !== 'locked') {
      throw new DomainError('INVALID_STATE', message);
    }
  }
}
