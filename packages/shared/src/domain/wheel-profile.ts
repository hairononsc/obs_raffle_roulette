import { z } from 'zod';

/**
 * A reusable named subset of the wheel: which prizes a purchase tier can
 * win, with optional per-prize weight overrides ("Black Friday" boosts).
 * Membership is baked into the entry's eligibility snapshot at
 * registration; only `weightOverrides` are consulted again at spin time.
 */
export const WheelProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  prizeIds: z.array(z.string().min(1)),
  weightOverrides: z.record(z.string(), z.number().positive()).optional(),
});

export const WheelProfileInputSchema = WheelProfileSchema.omit({ id: true });

export type WheelProfile = z.infer<typeof WheelProfileSchema>;
export type WheelProfileInput = z.infer<typeof WheelProfileInputSchema>;
