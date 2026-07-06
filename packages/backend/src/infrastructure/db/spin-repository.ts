import type { Kysely } from 'kysely';

import type { HistoryPage, SpinStats } from '../../domain/history.js';
import type { SpinStatus } from '../../domain/spin-lifecycle.js';
import type { SpinRecord } from '../../domain/spin-record.js';
import type { SpinRepository } from '../../application/ports/repositories.js';
import { spinToRow } from './mappers.js';
import type { Database } from './schema.js';

export class SqliteSpinRepository implements SpinRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(record: SpinRecord): Promise<void> {
    await this.db.insertInto('spins').values(spinToRow(record)).execute();
  }

  async updateStatus(
    spinId: string,
    status: SpinStatus,
    completedAt: number | null,
  ): Promise<void> {
    await this.db
      .updateTable('spins')
      .set({ status, completed_at: completedAt })
      .where('id', '=', spinId)
      .execute();
  }

  async completeAllUnfinished(completedAt: number): Promise<number> {
    const result = await this.db
      .updateTable('spins')
      .set({ status: 'completed', completed_at: completedAt })
      .where('status', '!=', 'completed')
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async history(limit: number, offset: number): Promise<HistoryPage> {
    const rows = await this.db
      .selectFrom('spins')
      .select([
        'id',
        'entry_id',
        'buyer_name',
        'prize_id',
        'prize_name',
        'started_at',
        'completed_at',
      ])
      .where('status', '=', 'completed')
      .orderBy('completed_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const countRow = await this.db
      .selectFrom('spins')
      .select((eb) => eb.fn.countAll().as('total'))
      .where('status', '=', 'completed')
      .executeTakeFirst();

    return {
      items: rows.map((row) => ({
        spinId: row.id,
        entryId: row.entry_id,
        buyerName: row.buyer_name,
        prizeId: row.prize_id,
        prizeName: row.prize_name,
        startedAt: row.started_at,
        completedAt: row.completed_at ?? 0,
      })),
      total: Number(countRow?.total ?? 0),
    };
  }

  async stats(): Promise<SpinStats> {
    const totals = await this.db
      .selectFrom('spins')
      .select((eb) => [
        eb.fn.countAll().as('total_spins'),
        eb.fn.count('buyer_name').distinct().as('total_buyers'),
      ])
      .where('status', '=', 'completed')
      .executeTakeFirst();

    const perPrize = await this.db
      .selectFrom('spins')
      .select((eb) => ['prize_id', 'prize_name', eb.fn.countAll().as('count')])
      .where('status', '=', 'completed')
      .groupBy(['prize_id', 'prize_name'])
      .orderBy('count', 'desc')
      .execute();

    return {
      totalSpins: Number(totals?.total_spins ?? 0),
      totalBuyers: Number(totals?.total_buyers ?? 0),
      prizeCounts: perPrize.map((row) => ({
        prizeId: row.prize_id,
        prizeName: row.prize_name,
        count: Number(row.count),
      })),
    };
  }
}
