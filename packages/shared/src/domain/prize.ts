import { z } from 'zod';

import { PrizeConditionsSchema } from './prize-conditions.js';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A prize that can appear on the wheel.
 *
 * - `weight` is a relative probability weight, not a percentage. Weights do
 *   not need to add up to anything: a prize with weight 2 is twice as likely
 *   as one with weight 1 among the eligible prizes.
 * - `stock` is the remaining physical inventory. `null` means unlimited.
 *   A prize with stock 0 is never selected by the server.
 * - `icon` is either a theme key (`prize-*`, resolved by the active theme
 *   in the widget) or a literal glyph such as an emoji, rendered as-is.
 */
export const PrizeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  weight: z.number().positive(),
  stock: z.number().int().min(0).nullable(),
  color: z.string().regex(HEX_COLOR_REGEX, 'must be a #RRGGBB hex color'),
  icon: z.string().min(1),
  active: z.boolean(),
  /** Estimated cost in RD$ — informative only (feeds the cost simulator),
   *  never affects selection. */
  cost: z.number().min(0).default(0),
  /** Eligibility rules evaluated per customer; `{}` = unconditional. */
  conditions: PrizeConditionsSchema.default({}),
  /** Winning this prize refunds the spin and auto-launches another one
   *  ("Vuelve a Girar"). */
  respin: z.boolean().default(false),
});

export type Prize = z.infer<typeof PrizeSchema>;

/** Prize fields provided by the operator; the server assigns the id. */
export const PrizeInputSchema = PrizeSchema.omit({ id: true });

export type PrizeInput = z.infer<typeof PrizeInputSchema>;
