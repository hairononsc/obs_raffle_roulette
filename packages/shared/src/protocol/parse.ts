import type { z } from 'zod';

import { ClientMessageSchema, type ClientMessage } from './client-messages.js';
import { ServerMessageSchema, type ServerMessage } from './server-messages.js';

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

// Input typed as `unknown`: schemas with .default() have an input type
// that differs from their output type.
function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: string): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'frame is not valid JSON' };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: details };
  }
  return { ok: true, message: result.data };
}

/** Validates a raw WebSocket frame received by the server. */
export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseWith(ClientMessageSchema, raw);
}

/** Validates a raw WebSocket frame received by the widget or the panel. */
export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  return parseWith(ServerMessageSchema, raw);
}
