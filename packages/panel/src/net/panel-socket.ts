import {
  createMessage,
  parseServerMessage,
  type ClientMessage,
  type ErrorCode,
  type HelloMessage,
  type ServerMessage,
} from '@wheellive/shared';

import { Emitter } from '../core/emitter.js';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

const REQUEST_TIMEOUT_MS = 5000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;

export class PanelRequestError extends Error {
  constructor(
    readonly code: ErrorCode | 'TIMEOUT' | 'OFFLINE',
    message: string,
  ) {
    super(message);
    this.name = 'PanelRequestError';
  }
}

/** Injectable socket surface so tests can drive the client without a server. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

const SOCKET_OPEN = 1;

interface PanelSocketEvents extends Record<string, unknown> {
  message: ServerMessage;
  status: ConnectionStatus;
}

interface PendingRequest {
  resolve: () => void;
  reject: (error: PanelRequestError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface PanelSocketOptions {
  url: string;
  socketFactory?: (url: string) => SocketLike;
}

/**
 * Reconnecting panel client. Every command gets a `requestId` and returns a
 * promise settled by the matching `ack`/`error`, so the UI can await its
 * own commands while broadcasts flow independently through `events`.
 */
export class PanelSocket {
  readonly events = new Emitter<PanelSocketEvents>();
  private socket: SocketLike | null = null;
  private status: ConnectionStatus = 'offline';
  private attempts = 0;
  private counter = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly factory: (url: string) => SocketLike;

  constructor(private readonly options: PanelSocketOptions) {
    this.factory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as SocketLike);
  }

  get currentStatus(): ConnectionStatus {
    return this.status;
  }

  connect(): void {
    this.setStatus('connecting');
    const socket = this.factory(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      socket.send(
        JSON.stringify(
          createMessage<HelloMessage>('hello', {
            role: 'panel',
            clientInfo: 'panel/0.1.0',
          }),
        ),
      );
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      const parsed = parseServerMessage(event.data);
      if (!parsed.ok) {
        console.warn('[panel] malformed frame:', parsed.error);
        return;
      }
      this.handleMessage(parsed.message);
    };

    socket.onclose = () => {
      this.socket = null;
      this.failAllPending('conexión perdida');
      this.setStatus('offline');
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  async request<M extends ClientMessage>(type: M['type'], payload: M['payload']): Promise<void> {
    const socket = this.socket;
    if (socket?.readyState !== SOCKET_OPEN) {
      throw new PanelRequestError('OFFLINE', 'sin conexión con el servidor');
    }
    this.counter += 1;
    const requestId = `p-${String(this.counter)}`;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new PanelRequestError('TIMEOUT', 'el servidor no respondió'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify(createMessage<M>(type, payload, requestId)));
    });
  }

  private handleMessage(message: ServerMessage): void {
    if (message.type === 'state.sync') {
      this.setStatus('online');
    }

    if ((message.type === 'ack' || message.type === 'error') && message.requestId !== undefined) {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        this.pending.delete(message.requestId);
        clearTimeout(pending.timer);
        if (message.type === 'ack') {
          pending.resolve();
        } else {
          pending.reject(new PanelRequestError(message.payload.code, message.payload.message));
        }
        return;
      }
    }
    this.events.emit('message', message);
  }

  private failAllPending(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new PanelRequestError('OFFLINE', reason));
    }
    this.pending.clear();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.events.emit('status', status);
  }

  private scheduleReconnect(): void {
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempts);
    this.attempts += 1;
    setTimeout(() => {
      if (this.status === 'offline') {
        this.connect();
      }
    }, delay);
  }
}

export function resolveWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws`;
}
