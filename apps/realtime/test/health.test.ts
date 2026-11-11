import { afterEach, describe, expect, it } from 'vitest';
import { createRealtimeServer, type RealtimeServerHandle } from '../src/server.js';

describe('realtime server /health', () => {
  let handle: RealtimeServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  it('responds 200 OK with service metadata on GET /health', async () => {
    handle = await createRealtimeServer({
      port: 0,
      webOrigin: 'http://localhost:3000',
    });

    const response = await fetch(`http://127.0.0.1:${handle.port}/health`);
    expect(response.status).toBe(200);

    const json = (await response.json()) as { ok: boolean; service: string };
    expect(json.ok).toBe(true);
    expect(json.service).toBe('realtime');
  });

  it('responds 404 on unknown paths', async () => {
    handle = await createRealtimeServer({
      port: 0,
      webOrigin: 'http://localhost:3000',
    });

    const response = await fetch(`http://127.0.0.1:${handle.port}/unknown`);
    expect(response.status).toBe(404);
  });
});

