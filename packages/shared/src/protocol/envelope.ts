import { z } from 'zod';

/**
 * Protocol version. Bump only on breaking changes to the message contract;
 * both sides reject frames whose `v` does not match.
 */
export const PROTOCOL_VERSION = 1;

/**
 * Builds the schema for one message type. Every WebSocket frame is a single
 * JSON envelope:
 *
 *   { "v": 1, "type": "queue.add", "ts": 1730000000000,
 *     "requestId": "req-42", "payload": { ... } }
 *
 * - `ts` is the sender's epoch-milliseconds timestamp (diagnostic only).
 * - `requestId` correlates a command with its `ack`/`error` reply. Commands
 *   sent by the panel should always carry one; broadcasts never need it.
 */
export function defineMessage<TType extends string, TPayload extends z.ZodTypeAny>(
  type: TType,
  payload: TPayload,
) {
  return z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    ts: z.number().int().nonnegative(),
    requestId: z.string().min(1).optional(),
    payload,
  });
}
