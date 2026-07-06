import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { migrate } from './migrations.js';
import type { Database } from './schema.js';

export function createDatabase(dbPath: string): Kysely<Database> {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite);

  return new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
}
