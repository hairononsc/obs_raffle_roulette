import type { Server as HttpServer } from 'node:http';

import { WebSocketServer, type WebSocket } from 'ws';

export interface WsServerOptions {
  httpServer: HttpServer;
  path: string;
  onConnection: (socket: WebSocket) => void;
}

/**
 * Attaches a WebSocket endpoint to an existing HTTP server so REST, the
 * WS hub and (later) the static widget/panel share a single port.
 */
export function attachWebSocketServer(options: WsServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  options.httpServer.on('upgrade', (request, socket, head) => {
    const pathname = (request.url ?? '').split('?')[0];
    if (pathname !== options.path) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });

  wss.on('connection', (socket: WebSocket) => {
    options.onConnection(socket);
  });

  return wss;
}
