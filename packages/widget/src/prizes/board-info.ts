import type { Prize, PrizeConditions } from '@wheellive/shared';

/**
 * Pure helpers for the public prize board: customer-facing rule text and
 * win probabilities. Kept DOM/Pixi-free for unit testing.
 *
 * Internal-only conditions (requiresApproval) are deliberately omitted —
 * the audience never sees operator mechanics.
 */

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const money = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });

function hourLabel(hour: number): string {
  if (hour === 0) {
    return '12am';
  }
  if (hour < 12) {
    return `${String(hour)}am`;
  }
  return hour === 12 ? '12pm' : `${String(hour - 12)}pm`;
}

/** Customer-facing rules for one prize; '¡todos participan!' when open. */
export function publicRules(conditions: PrizeConditions): string {
  const parts: string[] = [];
  if (conditions.minPurchase !== undefined) {
    parts.push(`compra mín. RD$${money.format(conditions.minPurchase)}`);
  }
  if (conditions.maxPurchase !== undefined) {
    parts.push(`compras hasta RD$${money.format(conditions.maxPurchase)}`);
  }
  if (conditions.minItems !== undefined) {
    parts.push(`${String(conditions.minItems)}+ artículos`);
  }
  if (conditions.daysOfWeek !== undefined) {
    parts.push(`solo ${conditions.daysOfWeek.map((day) => DAY_LETTERS[day] ?? '?').join('·')}`);
  }
  if (conditions.hourStart !== undefined || conditions.hourEnd !== undefined) {
    parts.push(`de ${hourLabel(conditions.hourStart ?? 0)} a ${hourLabel(conditions.hourEnd ?? 23)}`);
  }
  if (conditions.maxPerDay !== undefined) {
    parts.push(
      conditions.maxPerDay === 1 ? 'máx 1 por live' : `máx ${String(conditions.maxPerDay)} por live`,
    );
  }
  if (conditions.maxPerWeek !== undefined) {
    parts.push(`máx ${String(conditions.maxPerWeek)}/semana`);
  }
  if (conditions.maxPerMonth !== undefined) {
    parts.push(`máx ${String(conditions.maxPerMonth)}/mes`);
  }
  if (conditions.oncePerCustomer) {
    parts.push('una vez por cliente');
  }
  if (conditions.newCustomersOnly) {
    parts.push('solo clientes nuevos');
  }
  if (conditions.requiresActiveOffer) {
    parts.push('solo durante ofertas ⚡');
  }
  return parts.length === 0 ? '¡todos participan!' : parts.join(' · ');
}

/** Win % among winnable prizes (active + stock); null when not winnable. */
export function boardProbability(prize: Prize, prizes: readonly Prize[]): number | null {
  const winnable = prizes.filter(
    (candidate) => candidate.active && (candidate.stock === null || candidate.stock > 0),
  );
  if (!winnable.some((candidate) => candidate.id === prize.id)) {
    return null;
  }
  const total = winnable.reduce((sum, candidate) => sum + candidate.weight, 0);
  return total === 0 ? null : (prize.weight / total) * 100;
}
