import { WebSocket } from 'ws';
import type { ClientRole, ServerMessage } from '@wheellive/shared';

/** Tracks authenticated sockets and fans server messages out to them. */
export class ConnectionRegistry {
  private readonly clients = new Map<WebSocket, ClientRole>();

  add(socket: WebSocket, role: ClientRole): void {
    this.clients.set(socket, role);
  }

  remove(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  broadcast(message: ServerMessage): void {
    const raw = JSON.stringify(message);
    for (const socket of this.clients.keys()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(raw);
      }
    }
  }

  count(): number {
    return this.clients.size;
  }
}
