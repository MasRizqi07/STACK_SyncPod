import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { config, proxy } from '../src/proxy';

describe('Next.js 16 proxy route protection (3.6, D18)', () => {
  const originalMode = process.env.NEXT_PUBLIC_REALTIME_MODE;
  const originalSecret = process.env.AUTH_SECRET;
  const TEST_SECRET = 'proxy-test-auth-secret-32-bytes-minimum!';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_REALTIME_MODE = 'real';
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_REALTIME_MODE = originalMode;
    process.env.AUTH_SECRET = originalSecret;
  });

  it('matches /pod and all nested /pod/* paths', () => {
    expect(config.matcher).toEqual(['/pod', '/pod/:path*']);
  });

  it('redirects unauthenticated requests on /pod, /pod/x, /pod/x/selesai with 307 to /masuk in real mode', async () => {
    const protectedPaths = ['/pod', '/pod/pod-042', '/pod/pod-042/selesai'];

    for (const path of protectedPaths) {
      const req = new NextRequest(`http://localhost:3000${path}`);
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/masuk');
    }
  });

  it('rejects tampered/invalid session cookie with 307 to /masuk in real mode', async () => {
    const req = new NextRequest('http://localhost:3000/pod', {
      headers: {
        cookie: 'authjs.session-token=tampered.invalid.token',
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/masuk');
  });

  it('allows authenticated requests with valid Auth.js JWT cookie through in real mode', async () => {
    const cookieName = 'authjs.session-token';
    const token = await encode({
      token: {
        sub: 'user-demo-1',
        email: 'demo-1@demo.syncpod.local',
        name: 'Rizqi Pratama',
      },
      secret: TEST_SECRET,
      salt: cookieName,
    });

    const req = new NextRequest('http://localhost:3000/pod/pod-042', {
      headers: {
        cookie: `${cookieName}=${token}`,
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('bypasses auth completely in fake prototype mode without cookie or AUTH_SECRET (D18)', async () => {
    process.env.NEXT_PUBLIC_REALTIME_MODE = 'fake';
    delete process.env.AUTH_SECRET;

    const req = new NextRequest('http://localhost:3000/pod');
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
