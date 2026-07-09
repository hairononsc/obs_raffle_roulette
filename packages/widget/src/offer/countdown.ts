/**
 * Pure countdown helpers, kept free of Pixi imports so they are unit
 * testable. The countdown always derives from `endsAt` and the current
 * wall clock — never from accumulated frame deltas — so a paused or
 * throttled OBS ticker can never drift the timer.
 */

export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/** Formats to MM:SS, rounding seconds UP so a full 10-minute offer shows
 *  "10:00" and the display only hits "00:00" when time is truly over. */
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
