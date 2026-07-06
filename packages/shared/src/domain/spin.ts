import { z } from 'zod';

/**
 * Animation parameters decided by the server for a single spin. The widget
 * builds a deterministic easing curve from these values so the wheel always
 * lands exactly on the target segment, regardless of framerate.
 */
export const SpinAnimationSchema = z.object({
  durationMs: z.number().int().min(1000).max(60000),
  extraRotations: z.number().int().min(1).max(20),
});

export type SpinAnimation = z.infer<typeof SpinAnimationSchema>;

/**
 * Client-visible states of the spin lifecycle. `queued` and `completed`
 * spins are not "active", so they never appear here:
 *
 *   spinning → landed → celebrating → (completed)
 */
export const ActiveSpinStatusSchema = z.enum(['spinning', 'landed', 'celebrating']);

export type ActiveSpinStatus = z.infer<typeof ActiveSpinStatusSchema>;

/**
 * The spin currently in progress. This is part of `state.sync`, which makes
 * a freshly (re)connected widget able to resume or fast-forward mid-spin.
 * The outcome (`prizeId`, `targetSegmentIndex`) is already decided and
 * persisted by the server before this object ever reaches a client.
 */
export const ActiveSpinSchema = z.object({
  spinId: z.string().min(1),
  entryId: z.string().min(1),
  buyerName: z.string().min(1).max(50),
  prizeId: z.string().min(1),
  targetSegmentIndex: z.number().int().nonnegative(),
  animation: SpinAnimationSchema,
  status: ActiveSpinStatusSchema,
  startedAt: z.number().int().nonnegative(),
});

export type ActiveSpin = z.infer<typeof ActiveSpinSchema>;
