import type { PrizeConditions } from '@wheellive/shared';

/**
 * Pure helpers for the public prize board: customer-facing rule text.
 * Kept DOM/Pixi-free for unit testing.
 *
 * Internal-only conditions (requiresApproval) are deliberately omitted —
 * the audience never sees operator mechanics.
 */

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

/** True when the prize's day-of-week schedule includes today — the board
 *  only lists what can actually be won today. */
export function availableToday(conditions: PrizeConditions, dayOfWeek: number): boolean {
  return conditions.daysOfWeek === undefined || conditions.daysOfWeek.includes(dayOfWeek);
}

/** Customer-facing rules for one prize; '¡todos participan!' when open.
 *  Day-of-week rules are not rendered: day-gated prizes simply do not
 *  appear on days they don't apply. */
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

