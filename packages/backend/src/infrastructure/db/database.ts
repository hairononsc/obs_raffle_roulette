import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import pg from 'pg';

import { migratePostgres, migrateSqlite } from './migrations.js';
import type { Database } from './schema.js';

export interface DatabaseOptions {
  /** postgres:// connection string; null selects the SQLite file path. */
  dbUrl: string | null;
  dbPath: string;
}

/** Dual-dialect factory: `WHEELLIVE_DB_URL` picks Postgres (Docker/production),
 *  otherwise the embedded SQLite file (local runs and tests). */
export async function createDatabase(options: DatabaseOptions): Promise<Kysely<Database>> {
  if (options.dbUrl !== null) {
    return createPostgresDatabase(options.dbUrl);
  }
  return createSqliteDatabase(options.dbPath);
}

export function createSqliteDatabase(dbPath: string): Kysely<Database> {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrateSqlite(sqlite);

  return new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
}

const PG_INT8_OID = 20;
const CONNECT_ATTEMPTS = 5;
const CONNECT_RETRY_MS = 2000;

export async function createPostgresDatabase(url: string): Promise<Kysely<Database>> {
  // Epoch-ms timestamps live in BIGINT columns; the driver returns int8 as
  // strings by default, which would silently corrupt the WS protocol.
  // All our int8 values are epoch ms / counts, safely below 2^53.
  pg.types.setTypeParser(PG_INT8_OID, (value) => Number(value));

  const pool = new pg.Pool({ connectionString: url, max: 10 });

  // docker compose healthchecks cover the common case, but a cheap retry
  // makes the very first boot (initdb still warming up) robust too.
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < CONNECT_ATTEMPTS) {
        console.warn(
          `[wheellive] postgres not ready (attempt ${String(attempt)}/${String(CONNECT_ATTEMPTS)}), retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_MS));
      }
    }
  }
  if (lastError !== null) {
    throw lastError;
  }

  await migratePostgres(pool);
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
