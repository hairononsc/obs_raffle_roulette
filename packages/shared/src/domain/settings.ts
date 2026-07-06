import { z } from 'zod';

/**
 * Operator-tunable spin behaviour. The server draws each spin's concrete
 * animation values from these settings (`extraRotations` is picked uniformly
 * within the configured range so consecutive spins do not look identical).
 */
export const SpinSettingsSchema = z.object({
  durationMs: z.number().int().min(1000).max(60000),
  extraRotations: z
    .object({
      min: z.number().int().min(1).max(20),
      max: z.number().int().min(1).max(20),
    })
    .refine((range) => range.min <= range.max, {
      message: 'extraRotations.min must be <= extraRotations.max',
    }),
});

export type SpinSettings = z.infer<typeof SpinSettingsSchema>;
