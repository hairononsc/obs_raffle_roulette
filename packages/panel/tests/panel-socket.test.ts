import { createMessage, type AckMessage, type ErrorMessage } from '@wheellive/shared';
import { describe, expect, it } from 'vitest';

import { PanelRequestError, PanelSocket, type SocketLike } from '../src/net/panel-socket.js';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  lastSent(): { type: string; requestId?: string; payload: Record<string, unknown> } {
    const raw = this.sent.at(-1);
    if (raw === undefined) {
      throw new Error('nothing sent');
    }
    return JSON.parse(raw) as {
      type: string;
      requestId?: string;
      payload: Record<string, unknown>;
    };
  }
}

function createPair(): { socket: FakeSocket; client: PanelSocket } {
  const socket = new FakeSocket();
  const client = new PanelSocket({
    url: 'ws://test/ws',
    socketFactory: () => socket,
  });
  client.connect();
  return { socket, client };
}

describe('PanelSocket', () => {
  it('sends hello as panel on open', () => {
    const { socket } = createPair();
    socket.open();
    const hello = socket.lastSent();
    expect(hello.type).toBe('hello');
    expect(hello.payload.role).toBe('panel');
  });

  it('resolves a request when its ack arrives', async () => {
    const { socket, client } = createPair();
    socket.open();

    const pending = client.request('queue.add', { buyerName: 'Ana', spins: 1 });
    const sent = socket.lastSent();
    expect(sent.type).toBe('queue.add');
    expect(sent.requestId).toBeDefined();

    socket.receive(createMessage<AckMessage>('ack', {}, sent.requestId));
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects a request when the server answers with error', async () => {
    const { socket, client } = createPair();
    socket.open();

    const pending = client.request('spin.launch', { entryId: 'e1' });
    const sent = socket.lastSent();
    socket.receive(
      createMessage<ErrorMessage>(
        'error',
        { code: 'SPIN_IN_PROGRESS', message: 'busy' },
        sent.requestId,
      ),
    );

    await expect(pending).rejects.toMatchObject({ code: 'SPIN_IN_PROGRESS' });
  });

  it('rejects immediately when offline', async () => {
    const { client } = createPair();
    await expect(client.request('spin.launch', { entryId: 'e1' })).rejects.toBeInstanceOf(
      PanelRequestError,
    );
  });

  it('emits broadcasts but never emits correlated acks/errors', () => {
    const { socket, client } = createPair();
    socket.open();
    const received: string[] = [];
    client.events.on('message', (message) => {
      received.push(message.type);
    });

    void client.request('queue.add', { buyerName: 'Ana', spins: 1 }).catch(() => undefined);
    const sent = socket.lastSent();
    socket.receive(createMessage<AckMessage>('ack', {}, sent.requestId));
    socket.receive(createMessage('queue.changed', { queue: [] }));

    expect(received).toEqual(['queue.changed']);
  });

  it('fails pending requests when the connection drops', async () => {
    const { socket, client } = createPair();
    socket.open();
    const pending = client.request('spin.launch', { entryId: 'e1' });
    socket.close();
    await expect(pending).rejects.toMatchObject({ code: 'OFFLINE' });
  });
});
