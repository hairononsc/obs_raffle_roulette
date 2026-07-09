import type { Kysely } from 'kysely';

import type { RepositorySet, UnitOfWork } from '../../application/ports/repositories.js';
import { SqliteCustomerRepository } from './customer-repository.js';
import { SqlitePrizeRepository } from './prize-repository.js';
import { SqliteQueueRepository } from './queue-repository.js';
import type { Database } from './schema.js';
import { SqliteSettingsRepository } from './settings-repository.js';
import { SqliteSpinRepository } from './spin-repository.js';

function createRepositorySet(db: Kysely<Database>): RepositorySet {
  return {
    prizes: new SqlitePrizeRepository(db),
    queue: new SqliteQueueRepository(db),
    spins: new SqliteSpinRepository(db),
    settings: new SqliteSettingsRepository(db),
    customers: new SqliteCustomerRepository(db),
  };
}

/**
 * Every `run` executes inside one SQLite transaction; a thrown error
 * (including DomainError) rolls back everything the callback did.
 */
export class KyselyUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Kysely<Database>) {}

  async run<T>(work: (repos: RepositorySet) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) => work(createRepositorySet(trx)));
  }
}
