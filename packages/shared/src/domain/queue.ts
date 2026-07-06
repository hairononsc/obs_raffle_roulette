import { z } from 'zod';

/**
 * A buyer's pending spins. One purchase can grant several spins; the
 * operator launches them one at a time, so `spinsRemaining` counts down
 * as spins complete. Entries with 0 remaining spins leave the queue.
 */
export const QueueEntrySchema = z.object({
  id: z.string().min(1),
  buyerName: z.string().min(1).max(50),
  spinsTotal: z.number().int().min(1),
  spinsRemaining: z.number().int().min(0),
  note: z.string().max(200).optional(),
  createdAt: z.number().int().nonnegative(),
});

export type QueueEntry = z.infer<typeof QueueEntrySchema>;
