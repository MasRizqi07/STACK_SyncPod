import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyRealtimeToken } from '@syncpod/shared/realtime-token';

const authMock = vi.fn();

vi.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

import { GET } from '../src/app/api/realtime/token/route';

describe('GET /api/realtime/token (3.7, DESIGN B4)', () => {
  const originalSecret = process.env.REALTIME_JWT_SECRET;
  const TEST_SECRET = 'realtime-route-test-secret-32-bytes-ok!';

  beforeEach(() => {
    authMock.mockReset();
    process.env.REALTIME_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.REALTIME_JWT_SECRET = originalSecret;
  });

  it('returns 401 UNAUTHENTICATED when no session exists', async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 200 with verifiable HS256 JWT (exp - iat = 300) when session is valid', async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: 'user-demo-1',
        email: 'demo-1@demo.syncpod.local',
        name: 'Rizqi Pratama',
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { token: string; expiresAt: number };
    expect(typeof body.token).toBe('string');
    expect(typeof body.expiresAt).toBe('number');

    const verified = await verifyRealtimeToken(body.token, TEST_SECRET);
    expect(verified.userId).toBe('user-demo-1');
    expect(verified.exp - verified.iat).toBe(300);
    expect(body.expiresAt).toBe(verified.exp * 1000);
  });
});
