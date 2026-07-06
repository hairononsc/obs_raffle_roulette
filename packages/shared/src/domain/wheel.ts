import { z } from 'zod';

/**
 * One visual segment of the wheel, in clockwise display order.
 *
 * The server computes the segment layout from the current set of eligible
 * prizes and broadcasts it; the widget renders it verbatim and lands spins
 * on `wheel.spin.start.payload.spin.targetSegmentIndex`. The widget never
 * derives the layout on its own — server and widget must agree on indexes.
 */
export const WheelSegmentSchema = z.object({
  index: z.number().int().nonnegative(),
  prizeId: z.string().min(1),
  label: z.string().min(1).max(60),
  color: z.string().min(1),
  icon: z.string().min(1),
});

export type WheelSegment = z.infer<typeof WheelSegmentSchema>;
