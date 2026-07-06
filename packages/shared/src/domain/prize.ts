import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A prize that can appear on the wheel.
 *
 * - `weight` is a relative probability weight, not a percentage. Weights do
 *   not need to add up to anything: a prize with weight 2 is twice as likely
 *   as one with weight 1 among the eligible prizes.
 * - `stock` is the remaining physical inventory. `null` means unlimited.
 *   A prize with stock 0 is never selected by the server.
 * - `icon` is an asset key resolved by the active theme in the widget.
 */
export const PrizeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  weight: z.number().positive(),
  stock: z.number().int().min(0).nullable(),
  color: z.string().regex(HEX_COLOR_REGEX, 'must be a #RRGGBB hex color'),
  icon: z.string().min(1),
  active: z.boolean(),
});

export type Prize = z.infer<typeof PrizeSchema>;

/** Prize fields provided by the operator; the server assigns the id. */
export const PrizeInputSchema = PrizeSchema.omit({ id: true });

export type PrizeInput = z.infer<typeof PrizeInputSchema>;
