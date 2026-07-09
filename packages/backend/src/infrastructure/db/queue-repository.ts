import type { QueueEntry } from '@wheellive/shared';
import type { Kysely } from 'kysely';

import { DomainError } from '../../domain/errors.js';
import type { QueueRepository } from '../../application/ports/repositories.js';
import { queueEntryFromRow } from './mappers.js';
import type { Database } from './schema.js';

export class SqliteQueueRepository implements QueueRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async list(): Promise<QueueEntry[]> {
    const rows = await this.db
      .selectFrom('queue_entries')
      .selectAll()
      .where('spins_remaining', '>', 0)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();
    return rows.map(queueEntryFromRow);
  }

  async findById(id: string): Promise<QueueEntry | null> {
    const row = await this.db
      .selectFrom('queue_entries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? queueEntryFromRow(row) : null;
  }

  async create(entry: QueueEntry): Promise<void> {
    await this.db
      .insertInto('queue_entries')
      .values({
        id: entry.id,
        buyer_name: entry.buyerName,
        spins_total: entry.spinsTotal,
        spins_remaining: entry.spinsRemaining,
        note: entry.note ?? null,
        created_at: entry.createdAt,
        customer_id: entry.customerId ?? null,
        purchase_amount: entry.purchaseAmount ?? null,
        items_count: entry.itemsCount ?? null,
        profile_id: entry.profileId ?? null,
        eligible_prize_ids:
          entry.eligiblePrizeIds === undefined ? null : JSON.stringify(entry.eligiblePrizeIds),
      })
      .execute();
  }

  async decrementRemaining(id: string): Promise<void> {
    const result = await this.db
      .updateTable('queue_entries')
      .set((eb) => ({ spins_remaining: eb('spins_remaining', '-', 1) }))
      .where('id', '=', id)
      .where('spins_remaining', '>', 0)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      throw new DomainError('NO_SPINS_REMAINING', `entry "${id}" has no spins left`);
    }
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('queue_entries')
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}
