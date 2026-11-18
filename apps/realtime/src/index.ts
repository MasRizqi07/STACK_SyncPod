import { validateRealtimeEnv } from './env.js';
import { createRealtimeServer } from './server.js';

const env = validateRealtimeEnv(process.env);

const server = await createRealtimeServer({
  port: env.REALTIME_PORT,
  webOrigin: env.WEB_ORIGIN,
});
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
