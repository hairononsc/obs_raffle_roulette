import { z } from 'zod';

/** Preset durations offered by the panel, in milliseconds. */
export const OFFER_DURATIONS_MS = [
  60_000, 180_000, 300_000, 600_000, 900_000, 1_800_000,
] as const;

/**
 * An active flash offer. The absence of an offer is represented as `null`
 * wherever offer state travels (state.sync, offer.changed).
 *
 * `endsAt` (server epoch ms) is the single source of truth for the
 * countdown: clients render `endsAt - now` locally every frame, and the
 * server keeps one expiry timer as the authoritative closer.
 */
export const FlashOfferSchema = z.object({
  title: z.string().min(1).max(60),
  description: z.string().max(160),
  durationMs: z
    .number()
    .int()
    .min(60_000)
    .max(3_600_000),
  startedAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
});

export type FlashOffer = z.infer<typeof FlashOfferSchema>;
