import type { ClientMessage } from './client-messages.js';
import type { ServerMessage } from './server-messages.js';
import { PROTOCOL_VERSION } from './envelope.js';

export type AnyMessage = ClientMessage | ServerMessage;

/**
 * Builds a protocol envelope with the current timestamp. Narrow the result
 * by naming the message type explicitly:
 *
 *   const msg = createMessage<SpinLaunchMessage>('spin.launch', { entryId });
 */
export function createMessage<M extends AnyMessage>(
  type: M['type'],
  payload: M['payload'],
  requestId?: string,
): M {
  const envelope = {
    v: PROTOCOL_VERSION,
    type,
    ts: Date.now(),
    payload,
  };
  return (requestId === undefined ? envelope : { ...envelope, requestId }) as M;
}
