import type { Prize, PrizeConditions, WheelProfile } from '@wheellive/shared';

import { isEligible as hasStock } from './prize-selection.js';

/**
 * Pure per-customer eligibility engine. The service layer assembles the
 * context (queries, clock, offer state); no rule touches the database.
 *
 * Rules split into STATIC (evaluated once at registration, frozen into
 * the entry's snapshot) and DYNAMIC (re-checked at spin time because the
 * world changes between registration and launch).
 */

export interface AwardWindowCounts {
  day: number;
  week: number;
  month: number;
}

export interface EligibilityContext {
  now: number;
  /** Local day-of-week (0 = Sunday) and hour, precomputed by the caller. */
  dayOfWeek: number;
  hour: number;
  purchaseAmount?: number;
  itemsCount?: number;
  isNewCustomer: boolean;
  /** prizeId -> total awards for this customer (any time). */
  customerAwardCounts: Record<string, number>;
  /** prizeId -> awards in the current day/week/month windows. */
  prizeAwardCounts: Record<string, AwardWindowCounts>;
  offerActive: boolean;
  /** Prize ids the operator explicitly authorized (requiresApproval). */
  approvals: ReadonlySet<string>;
  profile?: WheelProfile | undefined;
  manualEnabled?: ReadonlySet<string> | undefined;
  manualDisabled?: ReadonlySet<string> | undefined;
}

export interface EligibilityResult {
  eligible: boolean;
  failedRules: string[];
}

type DynamicContext = Pick<
  EligibilityContext,
  'dayOfWeek' | 'hour' | 'offerActive' | 'customerAwardCounts' | 'prizeAwardCounts'
>;

function inHourWindow(conditions: PrizeConditions, hour: number): boolean {
  if (conditions.hourStart === undefined && conditions.hourEnd === undefined) {
    return true;
  }
  const start = conditions.hourStart ?? 0;
  const end = conditions.hourEnd ?? 23;
  // start > end means the window crosses midnight (e.g. 20 -> 02).
  return start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
}

/** Rules that can change between registration and spin time. */
function dynamicFailures(prize: Prize, ctx: DynamicContext): string[] {
  const failed: string[] = [];
  const c = prize.conditions;

  if (c.daysOfWeek && !c.daysOfWeek.includes(ctx.dayOfWeek)) {
    failed.push('daysOfWeek');
  }
  if (!inHourWindow(c, ctx.hour)) {
    failed.push('hourWindow');
  }

  const counts = ctx.prizeAwardCounts[prize.id] ?? { day: 0, week: 0, month: 0 };
  if (c.maxPerDay !== undefined && counts.day >= c.maxPerDay) {
    failed.push('maxPerDay');
  }
  if (c.maxPerWeek !== undefined && counts.week >= c.maxPerWeek) {
    failed.push('maxPerWeek');
  }
  if (c.maxPerMonth !== undefined && counts.month >= c.maxPerMonth) {
    failed.push('maxPerMonth');
  }
  if (c.oncePerCustomer && (ctx.customerAwardCounts[prize.id] ?? 0) > 0) {
    failed.push('oncePerCustomer');
  }
  if (c.requiresActiveOffer && !ctx.offerActive) {
    failed.push('requiresActiveOffer');
  }
  return failed;
}

/** Rules bound to the purchase/customer, frozen into the snapshot. */
function staticFailures(prize: Prize, ctx: EligibilityContext): string[] {
  const failed: string[] = [];
  const c = prize.conditions;

  // Missing purchase data is conservative: a min/max rule cannot pass
  // without knowing the amount.
  if (
    c.minPurchase !== undefined &&
    (ctx.purchaseAmount === undefined || ctx.purchaseAmount < c.minPurchase)
  ) {
    failed.push('minPurchase');
  }
  if (
    c.maxPurchase !== undefined &&
    (ctx.purchaseAmount === undefined || ctx.purchaseAmount > c.maxPurchase)
  ) {
    failed.push('maxPurchase');
  }
  if (c.minItems !== undefined && (ctx.itemsCount === undefined || ctx.itemsCount < c.minItems)) {
    failed.push('minItems');
  }
  if (c.newCustomersOnly && !ctx.isNewCustomer) {
    failed.push('newCustomersOnly');
  }
  if (c.requiresApproval && !ctx.approvals.has(prize.id)) {
    failed.push('requiresApproval');
  }
  return failed;
}

/**
 * Full evaluation for registration time. Collects EVERY failed rule (no
 * short-circuit) so the panel can explain exactly why a prize is blocked.
 */
export function evaluatePrize(prize: Prize, ctx: EligibilityContext): EligibilityResult {
  const failed: string[] = [];

  // Physical availability first: nothing overrides an absent prize.
  if (!prize.active) {
    failed.push('inactive');
  }
  if (prize.stock === 0) {
    failed.push('outOfStock');
  }
  // Manual disable always wins.
  if (ctx.manualDisabled?.has(prize.id)) {
    failed.push('manuallyDisabled');
    return { eligible: false, failedRules: failed };
  }
  if (failed.length > 0) {
    return { eligible: false, failedRules: failed };
  }

  // Manual enable forces eligibility past profile and conditions
  // (but never past active/stock, already checked above).
  if (ctx.manualEnabled?.has(prize.id)) {
    return { eligible: true, failedRules: [] };
  }

  if (ctx.profile && !ctx.profile.prizeIds.includes(prize.id)) {
    failed.push('notInProfile');
  }
  failed.push(...staticFailures(prize, ctx));
  failed.push(...dynamicFailures(prize, ctx));

  return { eligible: failed.length === 0, failedRules: failed };
}

export function filterEligible(prizes: readonly Prize[], ctx: EligibilityContext): Prize[] {
  return prizes.filter((prize) => evaluatePrize(prize, ctx).eligible);
}

/**
 * Spin-time filter: physical availability + the entry's frozen snapshot
 * + dynamic rules only. Static rules (purchase, approval, profile,
 * manual overrides) were already resolved into the snapshot.
 *
 * `snapshot === null` means a legacy entry with no personalization.
 */
export function filterEligibleAtLaunch(
  prizes: readonly Prize[],
  snapshot: ReadonlySet<string> | null,
  ctx: DynamicContext,
): Prize[] {
  return prizes.filter((prize) => {
    if (!hasStock(prize)) {
      return false;
    }
    if (snapshot !== null && !snapshot.has(prize.id)) {
      return false;
    }
    return dynamicFailures(prize, ctx).length === 0;
  });
}

/** Returns prizes with profile weight overrides applied (copy, not mutation). */
export function applyWeightOverrides(
  prizes: readonly Prize[],
  overrides?: Record<string, number>,
): Prize[] {
  if (!overrides) {
    return [...prizes];
  }
  return prizes.map((prize) => {
    const weight = overrides[prize.id];
    return weight !== undefined ? { ...prize, weight } : prize;
  });
}
