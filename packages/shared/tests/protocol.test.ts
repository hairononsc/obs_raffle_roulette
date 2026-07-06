import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  SpinSettingsSchema,
  createMessage,
  parseClientMessage,
  parseServerMessage,
  type ErrorMessage,
  type SpinLaunchMessage,
} from '../src/index.js';

describe('parseClientMessage', () => {
  it('parses a valid frame', () => {
    const raw = JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'spin.launch',
      ts: 1730000003000,
      requestId: 'req-1',
      payload: { entryId: 'entry-1' },
    });

    const result = parseClientMessage(raw);
    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === 'spin.launch') {
      expect(result.message.payload.entryId).toBe('entry-1');
    }
  });

  it('rejects frames that are not JSON', () => {
    const result = parseClientMessage('not json {');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('frame is not valid JSON');
    }
  });

  it('rejects frames with a different protocol version', () => {
    const raw = JSON.stringify({
      v: 999,
      type: 'spin.launch',
      ts: 1730000003000,
      payload: { entryId: 'entry-1' },
    });
    expect(parseClientMessage(raw).ok).toBe(false);
  });
});

describe('createMessage', () => {
  it('produces frames that satisfy the protocol schema', () => {
    const message = createMessage<SpinLaunchMessage>(
      'spin.launch',
      { entryId: 'entry-1' },
      'req-9',
    );

    expect(message.v).toBe(PROTOCOL_VERSION);
    expect(message.requestId).toBe('req-9');
    expect(parseClientMessage(JSON.stringify(message)).ok).toBe(true);
  });

  it('omits requestId when not provided', () => {
    const message = createMessage<ErrorMessage>('error', {
      code: 'INTERNAL_ERROR',
      message: 'boom',
    });

    expect('requestId' in message).toBe(false);
    expect(parseServerMessage(JSON.stringify(message)).ok).toBe(true);
  });
});

describe('SpinSettingsSchema', () => {
  it('rejects an inverted extraRotations range', () => {
    const result = SpinSettingsSchema.safeParse({
      durationMs: 8000,
      extraRotations: { min: 8, max: 3 },
    });
    expect(result.success).toBe(false);
  });
});
