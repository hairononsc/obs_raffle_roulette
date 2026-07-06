import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const DEFAULT_KEEP = 10;

/**
 * Copies the database file into a sibling `backups/` folder before it is
 * opened. The delivered-prize history is business-critical data; a corrupt
 * file or a bad migration should never be able to destroy the only copy.
 * ISO timestamps sort lexicographically, so pruning keeps the newest.
 */
export function backupDatabase(dbPath: string, keep = DEFAULT_KEEP): string | null {
  if (dbPath === ':memory:' || !existsSync(dbPath)) {
    return null;
  }

  const backupDir = join(dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = basename(dbPath);
  const target = join(backupDir, `${fileName}.${stamp}.bak`);
  copyFileSync(dbPath, target);

  const backups = readdirSync(backupDir)
    .filter((entry) => entry.startsWith(fileName) && entry.endsWith('.bak'))
    .sort();
  for (const stale of backups.slice(0, Math.max(0, backups.length - keep))) {
    rmSync(join(backupDir, stale));
  }

  return target;
}
