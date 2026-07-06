import type BetterSqlite3 from 'better-sqlite3';

/**
 * Ordered, append-only migrations applied via SQLite's `user_version`
 * pragma. Never edit a shipped migration — add a new one.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE prizes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    stock INTEGER,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE queue_entries (
    id TEXT PRIMARY KEY,
    buyer_name TEXT NOT NULL,
    spins_total INTEGER NOT NULL,
    spins_remaining INTEGER NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE spins (
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
  );

  CREATE INDEX idx_spins_status ON spins(status);
  CREATE INDEX idx_spins_completed_at ON spins(completed_at);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function migrate(sqlite: BetterSqlite3.Database): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const migration = MIGRATIONS[version];
    if (migration === undefined) {
      continue;
    }
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(migration);
      sqlite.pragma(`user_version = ${String(version + 1)}`);
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}
