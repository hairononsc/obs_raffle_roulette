/**
 * Kysely table typings. Column names are snake_case (SQL convention);
 * mapping to camelCase domain objects happens in `mappers.ts`.
 */
export interface PrizesTable {
  id: string;
  name: string;
  weight: number;
  stock: number | null;
  color: string;
  icon: string;
  active: number;
  created_at: number;
}

export interface QueueEntriesTable {
  id: string;
  buyer_name: string;
  spins_total: number;
  spins_remaining: number;
  note: string | null;
  created_at: number;
}

export interface SpinsTable {
  id: string;
  entry_id: string;
  buyer_name: string;
  prize_id: string;
  prize_name: string;
  target_segment_index: number;
  duration_ms: number;
  extra_rotations: number;
  status: string;
  started_at: number;
  completed_at: number | null;
}

export interface SettingsTable {
  key: string;
  value: string;
}

export interface Database {
  prizes: PrizesTable;
  queue_entries: QueueEntriesTable;
  spins: SpinsTable;
  settings: SettingsTable;
}
