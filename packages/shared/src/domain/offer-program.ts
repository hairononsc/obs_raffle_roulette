import { z } from 'zod';

export const OFFER_TEMPLATE_MAX_DURATION_MS = 1_800_000; // 30 min

/** A saved offer the program can fire. `id` is server-generated. */
export const OfferTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  description: z.string().max(160),
  durationMs: z.number().int().min(60_000).max(OFFER_TEMPLATE_MAX_DURATION_MS),
});

export const OfferTemplateInputSchema = OfferTemplateSchema.omit({ id: true });

export type OfferTemplate = z.infer<typeof OfferTemplateSchema>;
export type OfferTemplateInput = z.infer<typeof OfferTemplateInputSchema>;

/** Live-length presets for the panel: 2h to 4h in 30-minute steps. */
export const LIVE_DURATIONS_MS = [
  7_200_000, 9_000_000, 10_800_000, 12_600_000, 14_400_000,
] as const;

/**
 * An active offer program: the server fires a random pool template at each
 * `fireAt` time. `fireAt` holds only the REMAINING times (ascending);
 * `totalCount` remembers how many were planned so the panel can honestly
 * say "quedan 2 de 4". No status field — absence (`null`) means no program.
 */
export const OfferProgramStateSchema = z.object({
  startedAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
  fireAt: z.array(z.number().int().nonnegative()),
  totalCount: z.number().int().min(1),
});

export type OfferProgramState = z.infer<typeof OfferProgramStateSchema>;
