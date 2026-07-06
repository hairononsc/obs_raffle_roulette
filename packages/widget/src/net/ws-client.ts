import {
  createMessage,
  parseServerMessage,
  type ClientMessage,
  type HelloMessage,
  type ServerMessage,
} from '@wheellive/shared';

import { Emitter } from '../core/emitter.js';

const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;

interface WsClientEvents extends Record<string, unknown> {
  message: ServerMessage;
  connected: undefined;
  disconnected: undefined;
}

/**
 * Reconnecting WebSocket client for the widget role. Sends `hello` on every
 * (re)connection; the server answers with `state.sync`, which is the signal
 * the app uses to rebuild itself — reconnection and first boot are the
 * same code path by design.
 */
export class WsClient {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private closed = false;
  readonly events = new Emitter<WsClientEvents>();

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.closed) {
      return;
    }
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.send(
        createMessage<HelloMessage>('hello', { role: 'widget', clientInfo: 'widget/0.1.0' }),
      );
      this.events.emit('connected', undefined);
    };

    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') {
        return;
      }
      const parsed = parseServerMessage(event.data);
      if (parsed.ok) {
        this.events.emit('message', parsed.message);
      } else {
        console.warn('[ws] ignoring malformed frame:', parsed.error);
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.events.emit('disconnected', undefined);
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempts);
    this.attempts += 1;
    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export function resolveWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws`;
}
