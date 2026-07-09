import { OFFER_TEMPLATE_MAX_DURATION_MS } from '@wheellive/shared';

/** First fire no earlier than this after the program starts — let the
 *  audience build up before the first offer. */
export const PROGRAM_LEAD_IN_MS = 600_000; // 10 min
/** Minimum separation between fires so offers never overlap or fatigue. */
export const PROGRAM_MIN_GAP_MS = 1_200_000; // 20 min
/** Reserved at the end of the window: the longest possible offer must
 *  finish before the live does. */
export const PROGRAM_TAIL_MS = OFFER_TEMPLATE_MAX_DURATION_MS; // 30 min

export interface SchedulePlanInput {
  now: number;
  windowMs: number;
  count: number;
}

/**
 * Plans random fire times within a live window: the usable range (window
 * minus lead-in and tail) is split into equal slots, one fire uniformly
 * placed inside each slot minus a pad that guarantees the minimum gap to
 * the next slot's earliest position.
 *
 * Guarantees: ascending times; adjacent gaps >= PROGRAM_MIN_GAP_MS; first
 * fire >= now + lead-in; last fire <= now + window - tail. `count` is
 * clamped to what fits; an impossibly short window yields [].
 */
export function planOfferSchedule(
  input: SchedulePlanInput,
  random: () => number,
): number[] {
  const usable = input.windowMs - PROGRAM_LEAD_IN_MS - PROGRAM_TAIL_MS;
  if (usable <= 0 || input.count < 1) {
    return [];
  }
  const maxCount = Math.max(1, Math.floor(usable / PROGRAM_MIN_GAP_MS));
  const count = Math.min(input.count, maxCount);

  const slot = usable / count;
  const pad = Math.min(PROGRAM_MIN_GAP_MS, slot);
  const jitterRange = slot - pad;

  const times: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const base = input.now + PROGRAM_LEAD_IN_MS + index * slot;
    times.push(Math.round(base + random() * jitterRange));
  }
  return times;
}
