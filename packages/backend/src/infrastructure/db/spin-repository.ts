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

  /** Awards per prize since each boundary. Counts every spin by
   *  started_at (any status): the prize is decided and stock reserved at
   *  launch, so in-flight spins must count toward caps. */
  async countAwardsByPrize(since: {
    day: number;
    week: number;
    month: number;
  }): Promise<Record<string, { day: number; week: number; month: number }>> {
    const rows = await this.db
      .selectFrom('spins')
      .select((eb) => [
        'prize_id',
        eb.fn
          .sum(eb.case().when('started_at', '>=', since.day).then(1).else(0).end())
          .as('day_count'),
        eb.fn
          .sum(eb.case().when('started_at', '>=', since.week).then(1).else(0).end())
          .as('week_count'),
        eb.fn.countAll().as('month_count'),
      ])
      .where('started_at', '>=', since.month)
      .groupBy('prize_id')
      .execute();

    const counts: Record<string, { day: number; week: number; month: number }> = {};
    for (const row of rows) {
      counts[row.prize_id] = {
        day: Number(row.day_count),
        week: Number(row.week_count),
        month: Number(row.month_count),
      };
    }
    return counts;
  }

  /** Total awards per prize for one customer, all time, any status. */
  async countAwardsByCustomer(customerId: string): Promise<Record<string, number>> {
    const rows = await this.db
      .selectFrom('spins')
      .select((eb) => ['prize_id', eb.fn.countAll().as('count')])
      .where('customer_id', '=', customerId)
      .groupBy('prize_id')
      .execute();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.prize_id] = Number(row.count);
    }
    return counts;
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
