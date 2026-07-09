import { describe, expect, it } from 'vitest';

import { availableToday, publicRules } from '../src/prizes/board-info.js';


describe('publicRules', () => {
  it('open prizes invite everyone', () => {
    expect(publicRules({})).toBe('¡todos participan!');
  });

  it('renders customer-facing text for common rules', () => {
    expect(publicRules({ minPurchase: 750, maxPerDay: 1 })).toBe(
      'compra mín. RD$750 · máx 1 por live',
    );
    expect(publicRules({ requiresActiveOffer: true })).toBe('solo durante ofertas ⚡');
    expect(publicRules({ hourStart: 18, hourEnd: 22 })).toBe('de 6pm a 10pm');
    // Day rules are enforced by filtering, not by text.
    expect(publicRules({ daysOfWeek: [5, 6] })).toBe('¡todos participan!');
  });

  it('omits internal-only conditions', () => {
    expect(publicRules({ requiresApproval: true })).toBe('¡todos participan!');
  });
});

describe('availableToday', () => {
  it('no day rule means every day', () => {
    expect(availableToday({}, 2)).toBe(true);
  });

  it('day-gated prizes only appear on their days', () => {
    expect(availableToday({ daysOfWeek: [5, 6] }, 5)).toBe(true);
    expect(availableToday({ daysOfWeek: [5, 6] }, 2)).toBe(false);
  });
});

