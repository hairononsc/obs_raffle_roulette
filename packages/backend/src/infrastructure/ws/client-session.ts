import {
  createMessage,
  parseClientMessage,
  type AckMessage,
  type ClientMessage,
  type ClientRole,
  type ErrorCode,
  type ErrorMessage,
  type ServerMessage,
  type StateSyncMessage,
} from '@wheellive/shared';
import type { RawData, WebSocket } from 'ws';

import { DomainError } from '../../domain/errors.js';
import type { SnapshotService } from '../../application/services/snapshot-service.js';
import type { CommandDispatcher } from './command-dispatcher.js';
import type { ConnectionRegistry } from './connection-registry.js';

const HELLO_TIMEOUT_MS = 5000;

export interface ClientSessionDeps {
  registry: ConnectionRegistry;
  dispatcher: CommandDispatcher;
  snapshot: SnapshotService;
  panelToken: string;
}

/**
 * Per-connection state machine: awaiting `hello` -> authenticated. Every
 * authenticated command is answered with exactly one `ack` or `error`.
 */
export class ClientSession {
  private role: ClientRole | null = null;
  private helloTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly socket: WebSocket,
    private readonly deps: ClientSessionDeps,
  ) {}

  start(): void {
    this.helloTimer = setTimeout(() => {
      this.socket.close(4001, 'hello timeout');
    }, HELLO_TIMEOUT_MS);

    this.socket.on('message', (data: RawData) => {
      void this.onRawMessage(typeof data === 'string' ? data : (data as Buffer).toString('utf8'));
    });
    this.socket.on('close', () => {
      this.clearHelloTimer();
      this.deps.registry.remove(this.socket);
    });
    this.socket.on('error', () => {
      this.socket.close();
    });
  }

  private async onRawMessage(raw: string): Promise<void> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.sendError(undefined, 'INVALID_MESSAGE', parsed.error);
      return;
    }

    if (this.role === null) {
      await this.handleHello(parsed.message);
      return;
    }
    await this.handleCommand(parsed.message, this.role);
  }

  private async handleHello(message: ClientMessage): Promise<void> {
    if (message.type !== 'hello') {
      this.sendError(message.requestId, 'FORBIDDEN', 'first message must be "hello"');
      this.socket.close(4002, 'hello required');
      return;
    }

    const { role, token } = message.payload;
    if (role === 'panel' && token !== this.deps.panelToken) {
      this.sendError(message.requestId, 'UNAUTHORIZED', 'invalid panel token');
      this.socket.close(4003, 'unauthorized');
      return;
    }

    this.role = role;
    this.clearHelloTimer();
    this.deps.registry.add(this.socket, role);
    this.send(createMessage<StateSyncMessage>('state.sync', await this.deps.snapshot.build()));
  }

  private async handleCommand(message: ClientMessage, role: ClientRole): Promise<void> {
    try {
      await this.deps.dispatcher.dispatch(message, role);
      this.send(createMessage<AckMessage>('ack', {}, message.requestId));
    } catch (error) {
      if (error instanceof DomainError) {
        this.sendError(message.requestId, error.code, error.message);
        return;
      }
      console.error(`[ws] unexpected error handling "${message.type}"`, error);
      this.sendError(message.requestId, 'INTERNAL_ERROR', 'unexpected server error');
    }
  }

  private sendError(requestId: string | undefined, code: ErrorCode, message: string): void {
    this.send(createMessage<ErrorMessage>('error', { code, message }, requestId));
  }

  private send(message: ServerMessage): void {
    this.socket.send(JSON.stringify(message));
  }

  private clearHelloTimer(): void {
    if (this.helloTimer !== null) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }
  }
}
