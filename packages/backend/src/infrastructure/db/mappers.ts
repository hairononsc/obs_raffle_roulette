import { PrizeConditionsSchema, type Customer, type Prize, type QueueEntry } from '@wheellive/shared';

import type { SpinStatus } from '../../domain/spin-lifecycle.js';
import type { SpinRecord } from '../../domain/spin-record.js';
import type { CustomersTable, PrizesTable, QueueEntriesTable, SpinsTable } from './schema.js';

function parseConditions(raw: string): Prize['conditions'] {
  try {
    const parsed = PrizeConditionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function parsePrizeIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function prizeFromRow(row: PrizesTable): Prize {
  return {
    id: row.id,
    name: row.name,
    weight: row.weight,
    stock: row.stock,
    color: row.color,
    icon: row.icon,
    active: row.active === 1,
    cost: row.cost,
    conditions: parseConditions(row.conditions),
  };
}

export function queueEntryFromRow(row: QueueEntriesTable): QueueEntry {
  return {
    id: row.id,
    buyerName: row.buyer_name,
    spinsTotal: row.spins_total,
    spinsRemaining: row.spins_remaining,
    createdAt: row.created_at,
    ...(row.note !== null && { note: row.note }),
    ...(row.customer_id !== null && { customerId: row.customer_id }),
    ...(row.purchase_amount !== null && { purchaseAmount: row.purchase_amount }),
    ...(row.items_count !== null && { itemsCount: row.items_count }),
    ...(row.profile_id !== null && { profileId: row.profile_id }),
    ...(row.eligible_prize_ids !== null && {
      eligiblePrizeIds: parsePrizeIds(row.eligible_prize_ids),
    }),
  };
}

export function customerFromRow(row: CustomersTable): Customer {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    firstSeenAt: row.first_seen_at,
    ...(row.phone !== null && { phone: row.phone }),
  };
}

export function spinFromRow(row: SpinsTable): SpinRecord {
  return {
    spinId: row.id,
    entryId: row.entry_id,
    buyerName: row.buyer_name,
    prizeId: row.prize_id,
    prizeName: row.prize_name,
    targetSegmentIndex: row.target_segment_index,
    animation: { durationMs: row.duration_ms, extraRotations: row.extra_rotations },
    // The column is only ever written from SpinStatus values.
    status: row.status as SpinStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    customerId: row.customer_id,
  };
}

export function spinToRow(record: SpinRecord): SpinsTable {
  return {
    id: record.spinId,
    entry_id: record.entryId,
    buyer_name: record.buyerName,
    prize_id: record.prizeId,
    prize_name: record.prizeName,
    target_segment_index: record.targetSegmentIndex,
    duration_ms: record.animation.durationMs,
    extra_rotations: record.animation.extraRotations,
    status: record.status,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    customer_id: record.customerId,
  };
}
