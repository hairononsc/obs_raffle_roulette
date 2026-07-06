import {
  createMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@wheellive/shared';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppConfig } from '../src/config.js';
import { createApp, type WheelLiveApp } from '../src/container.js';

const TEST_CONFIG: AppConfig = {
  host: '127.0.0.1',
  port: 0,
  panelToken: 'test-token',
  dbPath: ':memory:',
  timing: { landingGraceMs: 30_000, celebrationMs: 50 },
  static: { widgetDist: null, panelDist: null },
};

class TestClient {
  readonly received: ServerMessage[] = [];
  private waiters: {
    predicate: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
  }[] = [];

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const raw = Buffer.isBuffer(data) ? data.toString('utf8') : '';
      const parsed = parseServerMessage(raw);
      if (parsed.ok) {
        this.received.push(parsed.message);
        this.waiters = this.waiters.filter((waiter) => {
          if (waiter.predicate(parsed.message)) {
            waiter.resolve(parsed.message);
            return false;
          }
          return true;
        });
      }
    });
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message));
  }

  async waitFor<T extends ServerMessage['type']>(
    type: T,
    timeoutMs = 3000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const existing = this.received.find((message) => message.type === type);
    if (existing) {
      return existing as Extract<ServerMessage, { type: T }>;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timed out waiting for "${type}"`));
      }, timeoutMs);
      this.waiters.push({
        predicate: (message) => message.type === type,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}

async function connect(wsUrl: string): Promise<TestClient> {
  const socket = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return new TestClient(socket);
}

describe('WebSocket server (end to end)', () => {
  let app: WheelLiveApp;
  let wsUrl: string;

  beforeAll(async () => {
    app = await createApp(TEST_CONFIG);
    const address = await app.start();
    wsUrl = `${address.replace(/^http/, 'ws')}/ws`;
  });

  afterAll(async () => {
    await app.stop();
  });

  it('rejects a panel with a wrong token', async () => {
    const client = await connect(wsUrl);
    client.send(createMessage('hello', { role: 'panel', token: 'wrong' }));
    const error = await client.waitFor('error');
    expect(error.payload.code).toBe('UNAUTHORIZED');
  });

  it('runs the full show flow: hello -> queue.add -> spin -> landed -> completed', async () => {
    const panel = await connect(wsUrl);
    panel.send(createMessage('hello', { role: 'panel', token: 'test-token' }));
    const panelSync = await panel.waitFor('state.sync');
    expect(panelSync.payload.prizes.length).toBeGreaterThan(0);
    expect(panelSync.payload.activeSpin).toBeNull();

    const widget = await connect(wsUrl);
    widget.send(createMessage('hello', { role: 'widget' }));
    await widget.waitFor('state.sync');

    panel.send(createMessage('queue.add', { buyerName: 'Carlos', spins: 2 }, 'req-add'));
    const ack = await panel.waitFor('ack');
    expect(ack.requestId).toBe('req-add');
    const queueChanged = await panel.waitFor('queue.changed');
    const entry = queueChanged.payload.queue[0];
    expect(entry?.buyerName).toBe('Carlos');
    if (!entry) {
      throw new Error('queue entry missing');
    }

    panel.send(createMessage('spin.launch', { entryId: entry.id }, 'req-spin'));
    const spinStart = await widget.waitFor('wheel.spin.start');
    expect(spinStart.payload.spin.buyerName).toBe('Carlos');

    // Widget cannot launch spins.
    widget.send(createMessage('spin.launch', { entryId: entry.id }, 'req-bad'));
    const forbidden = await widget.waitFor('error');
    expect(forbidden.payload.code).toBe('FORBIDDEN');

    widget.send(createMessage('wheel.spin.landed', { spinId: spinStart.payload.spin.spinId }));
    const completed = await panel.waitFor('spin.completed');
    expect(completed.payload.spinId).toBe(spinStart.payload.spin.spinId);
    expect(completed.payload.buyerName).toBe('Carlos');

    panel.close();
    widget.close();
  });

  it('a widget reconnecting mid-spin receives the active spin in state.sync', async () => {
    const panel = await connect(wsUrl);
    panel.send(createMessage('hello', { role: 'panel', token: 'test-token' }));
    await panel.waitFor('state.sync');

    panel.send(createMessage('queue.add', { buyerName: 'María', spins: 1 }, 'req-add2'));
    const queueChanged = await panel.waitFor('queue.changed');
    const entry = queueChanged.payload.queue.find((item) => item.buyerName === 'María');
    if (!entry) {
      throw new Error('queue entry missing');
    }

    panel.send(createMessage('spin.launch', { entryId: entry.id }, 'req-spin2'));
    await panel.waitFor('wheel.spin.start');

    // A widget that connects NOW (OBS reload) must see the spin in progress.
    const lateWidget = await connect(wsUrl);
    lateWidget.send(createMessage('hello', { role: 'widget' }));
    const sync = await lateWidget.waitFor('state.sync');
    expect(sync.payload.activeSpin?.buyerName).toBe('María');

    lateWidget.send(
      createMessage('wheel.spin.landed', {
        spinId: sync.payload.activeSpin?.spinId ?? '',
      }),
    );
    await panel.waitFor('spin.completed');

    panel.close();
    lateWidget.close();
  });

  it('serves history over REST after spins complete', async () => {
    const base = wsUrl.replace(/^ws/, 'http').replace('/ws', '');
    const response = await fetch(`${base}/api/history`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number; items: unknown[] };
    expect(body.total).toBeGreaterThanOrEqual(2);
  });
});
