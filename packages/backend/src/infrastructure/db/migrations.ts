import type BetterSqlite3 from 'better-sqlite3';
import type pg from 'pg';

/**
 * Ordered, append-only migrations, one DDL statement per string so both
 * drivers can run them individually. Never edit a shipped migration — add
 * a new entry. Progress is tracked in a portable `schema_migrations`
 * table (SQLite's `user_version` pragma does not exist in Postgres);
 * legacy SQLite databases that were migrated via `user_version` are
 * bootstrapped into the table without re-running DDL.
 *
 * Dialect differences are types only: epoch-ms timestamps need BIGINT in
 * Postgres (int4 overflows in 2038-adjacent values... and today's already
 * exceed 2^31), and JS numbers are float8, so REAL (float4 in PG) becomes
 * DOUBLE PRECISION. Booleans stay INTEGER 0/1 in both so the mappers and
 * repositories remain dialect-free.
 */
interface Migration {
  sqlite: readonly string[];
  postgres: readonly string[];
}

const MIGRATIONS: readonly Migration[] = [
  {
    sqlite: [
      `CREATE TABLE prizes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weight REAL NOT NULL,
        stock INTEGER,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE queue_entries (
        id TEXT PRIMARY KEY,
        buyer_name TEXT NOT NULL,
        spins_total INTEGER NOT NULL,
        spins_remaining INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE spins (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        prize_id TEXT NOT NULL,
        prize_name TEXT NOT NULL,
        target_segment_index INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        extra_rotations INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER
      )`,
      `CREATE INDEX idx_spins_status ON spins(status)`,
      `CREATE INDEX idx_spins_completed_at ON spins(completed_at)`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
    postgres: [
      `CREATE TABLE prizes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weight DOUBLE PRECISION NOT NULL,
        stock INTEGER,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL
      )`,
      `CREATE TABLE queue_entries (
        id TEXT PRIMARY KEY,
        buyer_name TEXT NOT NULL,
        spins_total INTEGER NOT NULL,
        spins_remaining INTEGER NOT NULL,
        note TEXT,
        created_at BIGINT NOT NULL
      )`,
      `CREATE TABLE spins (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        prize_id TEXT NOT NULL,
        prize_name TEXT NOT NULL,
        target_segment_index INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        extra_rotations INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at BIGINT NOT NULL,
        completed_at BIGINT
      )`,
      `CREATE INDEX idx_spins_status ON spins(status)`,
      `CREATE INDEX idx_spins_completed_at ON spins(completed_at)`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
  // v2 — per-customer eligibility engine: customers, purchase context on
  // queue entries, prize cost/conditions, and award-count indexes.
  {
    sqlite: [
      `ALTER TABLE prizes ADD COLUMN cost REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE prizes ADD COLUMN conditions TEXT NOT NULL DEFAULT '{}'`,
      `CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        phone TEXT,
        first_seen_at INTEGER NOT NULL
      )`,
      `ALTER TABLE queue_entries ADD COLUMN customer_id TEXT`,
      `ALTER TABLE queue_entries ADD COLUMN purchase_amount REAL`,
      `ALTER TABLE queue_entries ADD COLUMN items_count INTEGER`,
      `ALTER TABLE queue_entries ADD COLUMN profile_id TEXT`,
      `ALTER TABLE queue_entries ADD COLUMN eligible_prize_ids TEXT`,
      `ALTER TABLE spins ADD COLUMN customer_id TEXT`,
      `CREATE INDEX idx_spins_prize_started ON spins(prize_id, started_at)`,
      `CREATE INDEX idx_spins_customer_prize ON spins(customer_id, prize_id)`,
    ],
    postgres: [
      `ALTER TABLE prizes ADD COLUMN cost DOUBLE PRECISION NOT NULL DEFAULT 0`,
      `ALTER TABLE prizes ADD COLUMN conditions TEXT NOT NULL DEFAULT '{}'`,
      `CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        phone TEXT,
        first_seen_at BIGINT NOT NULL
      )`,
      `ALTER TABLE queue_entries ADD COLUMN customer_id TEXT`,
      `ALTER TABLE queue_entries ADD COLUMN purchase_amount DOUBLE PRECISION`,
      `ALTER TABLE queue_entries ADD COLUMN items_count INTEGER`,
      `ALTER TABLE queue_entries ADD COLUMN profile_id TEXT`,
      `ALTER TABLE queue_entries ADD COLUMN eligible_prize_ids TEXT`,
      `ALTER TABLE spins ADD COLUMN customer_id TEXT`,
      `CREATE INDEX idx_spins_prize_started ON spins(prize_id, started_at)`,
      `CREATE INDEX idx_spins_customer_prize ON spins(customer_id, prize_id)`,
    ],
  },
  // v3 — auto re-spin flag on prizes ("Vuelve a Girar").
  {
    sqlite: [`ALTER TABLE prizes ADD COLUMN respin INTEGER NOT NULL DEFAULT 0`],
    postgres: [`ALTER TABLE prizes ADD COLUMN respin INTEGER NOT NULL DEFAULT 0`],
  },
];

const CREATE_TRACKING_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at BIGINT NOT NULL
)`;

export function migrateSqlite(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(CREATE_TRACKING_TABLE);

  // Legacy bootstrap: databases migrated under the old user_version scheme
  // record those versions as applied instead of re-running their DDL.
  const applied = (
    sqlite.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  ).map((row) => row.version);
  if (applied.length === 0) {
    const legacy = sqlite.pragma('user_version', { simple: true }) as number;
    const insert = sqlite.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
    for (let version = 1; version <= legacy; version += 1) {
      insert.run(version, Date.now());
      applied.push(version);
    }
  }

  const start = applied.length === 0 ? 0 : Math.max(...applied);
  for (let index = start; index < MIGRATIONS.length; index += 1) {
    const statements = MIGRATIONS[index]?.sqlite;
    if (!statements) {
      continue;
    }
    sqlite.exec('BEGIN');
    try {
      for (const statement of statements) {
        sqlite.exec(statement);
      }
      sqlite
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(index + 1, Date.now());
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

export async function migratePostgres(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TRACKING_TABLE);
    const result = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    // version is INTEGER (int4): the pg driver already returns a number.
    const appliedMax = result.rows.reduce((max, row) => Math.max(max, row.version), 0);

    for (let index = appliedMax; index < MIGRATIONS.length; index += 1) {
      const statements = MIGRATIONS[index]?.postgres;
      if (!statements) {
        continue;
      }
      await client.query('BEGIN');
      try {
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [
          index + 1,
          Date.now(),
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
