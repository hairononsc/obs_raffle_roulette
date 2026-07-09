import { z } from 'zod';

export const ChestStatusSchema = z.enum(['locked', 'unlocked']);

export type ChestStatus = z.infer<typeof ChestStatusSchema>;

/**
 * Live chest state. The audience earns keys (one per operator action);
 * reaching `keysTarget` unlocks the chest and reveals `prize`.
 *
 * No cross-field refine (`keys <= keysTarget`): persisted state is parsed
 * with a fallback default, and a `configure` that lowers the target must
 * not invalidate stored state — the service enforces invariants by clamping.
 */
export const ChestStateSchema = z.object({
  keys: z.number().int().min(0).max(999),
  keysTarget: z.number().int().min(1).max(50),
  /** Free text with emoji, e.g. "👖 Jean Gratis". */
  prize: z.string().min(1).max(100),
  status: ChestStatusSchema,
});

export type ChestState = z.infer<typeof ChestStateSchema>;
