import { createRealtimeServer } from './server.js';

function readPort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid REALTIME_PORT value: ${raw}`);
  }
  return parsed;
}

const port = readPort(process.env.REALTIME_PORT ?? process.env.PORT, 4000);
const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';

const server = await createRealtimeServer({ port, webOrigin });
console.log(`SyncPod realtime server listening on http://localhost:${server.port}`);

const shutdown = async (): Promise<void> => {
  await server.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

