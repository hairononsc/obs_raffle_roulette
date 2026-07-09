/**
 * Natural calendar windows in the server's LOCAL time zone. "Max 2 per
 * day" in the business means the calendar day, not a rolling 24h window.
 * All functions are pure given a timestamp; the TZ comes from the
 * process environment (set TZ in Docker if it must differ from the host).
 */

/** Midnight of the local day containing `now`. */
export function dayStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Midnight of the Monday of the local week containing `now`. */
export function weekStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  date.setDate(date.getDate() - sinceMonday);
  return date.getTime();
}

/** Midnight of the 1st of the local month containing `now`. */
export function monthStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date.getTime();
}

/** Local day-of-week (0 = Sunday, JS convention) and hour for `now`. */
export function localDayHour(now: number): { dayOfWeek: number; hour: number } {
  const date = new Date(now);
  return { dayOfWeek: date.getDay(), hour: date.getHours() };
}
