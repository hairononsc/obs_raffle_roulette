import type { Prize, PrizeConditions, QueueEntry, WheelProfile } from '@wheellive/shared';

import { winProbability } from '../state/store.js';

/**
 * Pure helpers behind the smart-wheel panel widgets: condition summaries,
 * expected-cost math, selection diffs and eligibility chips. DOM-free so
 * they are unit-testable.
 */

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const formatMoney = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });

export function formatRd(amount: number): string {
  return `RD$${formatMoney.format(amount)}`;
}

function conditionTokens(conditions: PrizeConditions): string[] {
  const tokens: string[] = [];
  if (conditions.minPurchase !== undefined) {
    tokens.push(`≥${formatRd(conditions.minPurchase)}`);
  }
  if (conditions.maxPurchase !== undefined) {
    tokens.push(`≤${formatRd(conditions.maxPurchase)}`);
  }
  if (conditions.minItems !== undefined) {
    tokens.push(`≥${String(conditions.minItems)} art.`);
  }
  if (conditions.daysOfWeek !== undefined) {
    tokens.push(conditions.daysOfWeek.map((day) => DAY_LETTERS[day] ?? '?').join('·'));
  }
  if (conditions.hourStart !== undefined || conditions.hourEnd !== undefined) {
    tokens.push(`${String(conditions.hourStart ?? 0)}–${String(conditions.hourEnd ?? 23)}h`);
  }
  if (conditions.maxPerDay !== undefined) {
    tokens.push(`máx ${String(conditions.maxPerDay)}/día`);
  }
  if (conditions.maxPerWeek !== undefined) {
    tokens.push(`máx ${String(conditions.maxPerWeek)}/sem`);
  }
  if (conditions.maxPerMonth !== undefined) {
    tokens.push(`máx ${String(conditions.maxPerMonth)}/mes`);
  }
  if (conditions.oncePerCustomer) {
    tokens.push('1×cliente');
  }
  if (conditions.newCustomersOnly) {
    tokens.push('solo nuevos');
  }
  if (conditions.requiresActiveOffer) {
    tokens.push('c/oferta');
  }
  if (conditions.requiresApproval) {
    tokens.push('⚠ aprob.');
  }
  return tokens;
}

/** Compact summary for the prizes table: up to 3 tokens plus "+n". */
export function formatConditionsSummary(conditions?: PrizeConditions): string {
  const tokens = conditionTokens(conditions ?? {});
  if (tokens.length === 0) {
    return '—';
  }
  if (tokens.length <= 3) {
    return tokens.join(' · ');
  }
  return `${tokens.slice(0, 3).join(' · ')} +${String(tokens.length - 3)}`;
}

/** Untruncated version for tooltips. */
export function formatConditionsFull(conditions?: PrizeConditions): string {
  const tokens = conditionTokens(conditions ?? {});
  return tokens.length === 0 ? 'Sin condiciones' : tokens.join(' · ');
}

/** Expected cost per spin: Σ probability × cost over winnable prizes. */
export function expectedCostPerSpin(prizes: readonly Prize[]): number {
  return prizes.reduce((sum, prize) => {
    const probability = winProbability(prize, prizes);
    if (probability === null) {
      return sum;
    }
    return sum + (probability / 100) * prize.cost;
  }, 0);
}

/** Deltas between a baseline selection and the operator's final picks. */
export function diffPrizeSelection(
  baseline: ReadonlySet<string>,
  selected: ReadonlySet<string>,
): { enabledPrizeIds?: string[]; disabledPrizeIds?: string[] } {
  const enabled = [...selected].filter((id) => !baseline.has(id));
  const disabled = [...baseline].filter((id) => !selected.has(id));
  return {
    ...(enabled.length > 0 && { enabledPrizeIds: enabled }),
    ...(disabled.length > 0 && { disabledPrizeIds: disabled }),
  };
}

export interface EligibilitySummary {
  label: string;
  profileName: string | null;
  blockedNames: string[];
}

/**
 * Chip for a queue row. Returns null when there is nothing to show:
 * legacy entries without snapshot, or a snapshot that excludes nothing.
 */
export function summarizeEligibility(
  entry: QueueEntry,
  prizes: readonly Prize[],
  profiles: readonly WheelProfile[],
): EligibilitySummary | null {
  if (entry.eligiblePrizeIds === undefined) {
    return null;
  }
  const eligible = new Set(entry.eligiblePrizeIds);
  const activePrizes = prizes.filter((prize) => prize.active);
  const blockedNames = activePrizes
    .filter((prize) => !eligible.has(prize.id))
    .map((prize) => prize.name);
  if (blockedNames.length === 0) {
    return null;
  }
  const profile = entry.profileId
    ? (profiles.find((candidate) => candidate.id === entry.profileId) ?? null)
    : null;
  const eligibleCount = activePrizes.filter((prize) => eligible.has(prize.id)).length;
  return {
    label: `🎯 ${String(eligibleCount)}/${String(activePrizes.length)} premios`,
    profileName: entry.profileId ? (profile?.name ?? 'perfil eliminado') : null,
    blockedNames,
  };
}
