import { z } from 'zod';

/**
 * Business rules that gate whether a prize is winnable by a given customer
 * at a given moment. Every field is optional; `{}` means unconditional.
 *
 * - `daysOfWeek` uses JS Date convention: 0 = Sunday .. 6 = Saturday.
 * - `hourStart`/`hourEnd` form an inclusive window in the server's local
 *   time; `hourStart > hourEnd` means the window crosses midnight.
 * - `maxPerDay/Week/Month` are global caps per prize, over natural
 *   calendar windows (local day / ISO week from Monday / natural month).
 * - `requiresApproval` prizes are only eligible when the operator
 *   explicitly authorizes them while registering the purchase.
 */
export const PrizeConditionsSchema = z.object({
  minPurchase: z.number().nonnegative().optional(),
  maxPurchase: z.number().nonnegative().optional(),
  minItems: z.number().int().min(1).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  hourStart: z.number().int().min(0).max(23).optional(),
  hourEnd: z.number().int().min(0).max(23).optional(),
  maxPerDay: z.number().int().min(1).optional(),
  maxPerWeek: z.number().int().min(1).optional(),
  maxPerMonth: z.number().int().min(1).optional(),
  oncePerCustomer: z.boolean().optional(),
  newCustomersOnly: z.boolean().optional(),
  requiresActiveOffer: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
});

export type PrizeConditions = z.infer<typeof PrizeConditionsSchema>;
