import type { Customer } from '@wheellive/shared';
import type { Kysely } from 'kysely';

import type { CustomerRepository } from '../../application/ports/repositories.js';
import { customerFromRow } from './mappers.js';
import type { Database } from './schema.js';

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByNormalizedName(normalizedName: string): Promise<Customer | null> {
    const row = await this.db
      .selectFrom('customers')
      .selectAll()
      .where('normalized_name', '=', normalizedName)
      .executeTakeFirst();
    return row ? customerFromRow(row) : null;
  }

  async create(customer: Customer): Promise<void> {
    await this.db
      .insertInto('customers')
      .values({
        id: customer.id,
        name: customer.name,
        normalized_name: customer.normalizedName,
        phone: customer.phone ?? null,
        first_seen_at: customer.firstSeenAt,
      })
      .execute();
  }

  async setPhone(id: string, phone: string): Promise<void> {
    await this.db
      .updateTable('customers')
      .set({ phone })
      .where('id', '=', id)
      .where('phone', 'is', null)
      .execute();
  }
}
