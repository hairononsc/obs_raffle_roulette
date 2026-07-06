import type { ActiveSpin, SpinAnimation } from '@wheellive/shared';

import type { SpinStatus } from './spin-lifecycle.js';

/**
 * The persisted record of a spin. `prizeName` is snapshotted at decision
 * time so history stays correct even if the prize is renamed or deleted.
 */
export interface SpinRecord {
  spinId: string;
  entryId: string;
  buyerName: string;
  prizeId: string;
  prizeName: string;
  targetSegmentIndex: number;
  animation: SpinAnimation;
  status: SpinStatus;
  startedAt: number;
  completedAt: number | null;
}

/** Protocol view of a spin; `null` once the spin is completed. */
export function toActiveSpin(record: SpinRecord): ActiveSpin | null {
  if (record.status === 'completed') {
    return null;
  }
  return {
    spinId: record.spinId,
    entryId: record.entryId,
    buyerName: record.buyerName,
    prizeId: record.prizeId,
    targetSegmentIndex: record.targetSegmentIndex,
    animation: record.animation,
    status: record.status,
    startedAt: record.startedAt,
  };
}
