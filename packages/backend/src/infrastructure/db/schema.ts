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
  cost: number;
  /** JSON-encoded PrizeConditions; '{}' = unconditional. */
  conditions: string;
}

export interface QueueEntriesTable {
  id: string;
  buyer_name: string;
  spins_total: number;
  spins_remaining: number;
  note: string | null;
  created_at: number;
  customer_id: string | null;
  purchase_amount: number | null;
  items_count: number | null;
  profile_id: string | null;
  /** JSON-encoded string[]; NULL = legacy entry with no personalization. */
  eligible_prize_ids: string | null;
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
  customer_id: string | null;
}

export interface SettingsTable {
  key: string;
  value: string;
}

export interface CustomersTable {
  id: string;
  name: string;
  normalized_name: string;
  phone: string | null;
  first_seen_at: number;
}

export interface Database {
  prizes: PrizesTable;
  queue_entries: QueueEntriesTable;
  spins: SpinsTable;
  settings: SettingsTable;
  customers: CustomersTable;
}
