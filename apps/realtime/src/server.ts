import { createServer, type IncomingMessage, type ServerResponse, type Server as HttpServer } from 'node:http';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@syncpod/shared';

export interface RealtimeServerOptions {
  port: number;
  webOrigin: string;
}

export interface RealtimeServerHandle {
  httpServer: HttpServer;
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  port: number;
  close: () => Promise<void>;
}

function applyCorsHeaders(res: ServerResponse, originHeader: string | undefined, allowedOrigin: string): void {
  if (originHeader && originHeader === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

export async function createRealtimeServer(
  options: RealtimeServerOptions,
): Promise<RealtimeServerHandle> {
  const helmetMiddleware = helmet();

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    helmetMiddleware(req, res, () => {
      applyCorsHeaders(res, req.headers.origin, options.webOrigin);

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        const body = JSON.stringify({
          ok: true,
          service: 'realtime',
          uptimeSec: Math.round(process.uptime()),
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(body);
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    });
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: options.webOrigin,
      credentials: true,
    },
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : options.port;

  return {
    httpServer,
    io,
    port: actualPort,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        io.close((err?: Error) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
  };
}

