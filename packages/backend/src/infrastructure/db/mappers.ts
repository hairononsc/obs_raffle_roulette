import type { Prize, QueueEntry } from '@wheellive/shared';

import type { SpinStatus } from '../../domain/spin-lifecycle.js';
import type { SpinRecord } from '../../domain/spin-record.js';
import type { PrizesTable, QueueEntriesTable, SpinsTable } from './schema.js';

export function prizeFromRow(row: PrizesTable): Prize {
  return {
    id: row.id,
    name: row.name,
    weight: row.weight,
    stock: row.stock,
    color: row.color,
    icon: row.icon,
    active: row.active === 1,
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
  };
}
