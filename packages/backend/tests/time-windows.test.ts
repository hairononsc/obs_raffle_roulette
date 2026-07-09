import { describe, expect, it } from 'vitest';

import { dayStart, localDayHour, monthStart, weekStart } from '../src/domain/time-windows.js';

// Local-time constructions keep these tests TZ-independent.
const wed = new Date(2026, 6, 8, 15, 30).getTime(); // Wed Jul 8 2026, 15:30 local

describe('time windows (local calendar)', () => {
  it('dayStart is local midnight', () => {
    expect(dayStart(wed)).toBe(new Date(2026, 6, 8, 0, 0, 0, 0).getTime());
  });

  it('weekStart is the Monday of the week', () => {
    expect(weekStart(wed)).toBe(new Date(2026, 6, 6, 0, 0, 0, 0).getTime()); // Mon Jul 6
    // A Sunday belongs to the week started the previous Monday.
    const sun = new Date(2026, 6, 12, 10, 0).getTime();
    expect(weekStart(sun)).toBe(new Date(2026, 6, 6, 0, 0, 0, 0).getTime());
    // A Monday is its own week start.
    const mon = new Date(2026, 6, 6, 0, 0).getTime();
    expect(weekStart(mon)).toBe(mon);
  });

  it('monthStart is the 1st of the month', () => {
    expect(monthStart(wed)).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).getTime());
  });

  it('localDayHour matches Date getters', () => {
    expect(localDayHour(wed)).toEqual({ dayOfWeek: 3, hour: 15 });
  });
});
