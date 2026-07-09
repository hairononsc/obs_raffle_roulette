import type { Prize } from '@wheellive/shared';
import type { Kysely } from 'kysely';

import { DomainError } from '../../domain/errors.js';
import type { PrizeRepository } from '../../application/ports/repositories.js';
import { prizeFromRow } from './mappers.js';
import type { Database } from './schema.js';

export class SqlitePrizeRepository implements PrizeRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async list(): Promise<Prize[]> {
    const rows = await this.db
      .selectFrom('prizes')
      .selectAll()
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();
    return rows.map(prizeFromRow);
  }

  async findById(id: string): Promise<Prize | null> {
    const row = await this.db
      .selectFrom('prizes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? prizeFromRow(row) : null;
  }

  async create(prize: Prize, createdAt: number): Promise<void> {
    await this.db
      .insertInto('prizes')
      .values({
        id: prize.id,
        name: prize.name,
        weight: prize.weight,
        stock: prize.stock,
        color: prize.color,
        icon: prize.icon,
        active: prize.active ? 1 : 0,
        created_at: createdAt,
        cost: prize.cost,
        conditions: JSON.stringify(prize.conditions),
      })
      .execute();
  }

  async update(prize: Prize): Promise<void> {
    await this.db
      .updateTable('prizes')
      .set({
        name: prize.name,
        weight: prize.weight,
        stock: prize.stock,
        color: prize.color,
        icon: prize.icon,
        active: prize.active ? 1 : 0,
        cost: prize.cost,
        conditions: JSON.stringify(prize.conditions),
      })
      .where('id', '=', prize.id)
      .execute();
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('prizes').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async decrementStock(id: string): Promise<void> {
    const result = await this.db
      .updateTable('prizes')
      .set((eb) => ({ stock: eb('stock', '-', 1) }))
      .where('id', '=', id)
      .where('stock', '>', 0)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      throw new DomainError('INTERNAL_ERROR', `cannot reserve stock for prize "${id}"`);
    }
  }
}
