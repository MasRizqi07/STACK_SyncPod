import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '@syncpod/db';
import { signIn } from '../src/auth';
import { POST } from '../src/app/api/demo/login/route';
import { resetEnvCache } from '../src/env';

vi.mock('../src/auth', () => ({
  signIn: vi.fn().mockResolvedValue('/'),
}));

describe('POST /api/demo/login (D10, 3.5)', () => {
  const originalDemoMode = process.env.DEMO_MODE;
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    process.env.AUTH_SECRET = 'test-auth-secret-32-bytes-minimum-ok!!';
    resetEnvCache();
    await db.user.upsert({
      where: { email: 'demo-1@demo.syncpod.local' },
      update: { name: 'Rizqi Pratama' },
      create: {
        email: 'demo-1@demo.syncpod.local',
        name: 'Rizqi Pratama',
      },
    });
  });

  beforeEach(() => {
    resetEnvCache();
  });

  afterAll(() => {
    process.env.DEMO_MODE = originalDemoMode;
    process.env.AUTH_SECRET = originalAuthSecret;
    resetEnvCache();
  });

  it('returns 403 immediately when DEMO_MODE is not true', async () => {
    process.env.DEMO_MODE = 'false';
    const req = new Request('http://localhost:3000/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('FORBIDDEN');
    expect(data.error.message).toContain('Demo mode is disabled');
    process.env.DEMO_MODE = 'true';
  });

  it('returns 403 when bot email tries to log in (D8)', async () => {
    const req = new Request('http://localhost:3000/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'simulasi-1@bot.syncpod.local' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.message).toContain('Bot accounts cannot log in');
  });

  it('returns 403 when an arbitrary / unseeded email tries to log in (D10)', async () => {
    const emails = ['random@gmail.com', 'attacker@evil.com', 'student@mhs.itats.ac.id'];

    for (const email of emails) {
      const req = new Request('http://localhost:3000/api/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toContain('Only seeded demo accounts can log in');
    }
  });

  it('returns 400 when request body is invalid or missing email', async () => {
    const req1 = new Request('http://localhost:3000/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    const req2 = new Request('http://localhost:3000/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it('returns 200 and delegates cookie generation to Auth.js signIn for valid seeded demo user (D34)', async () => {
    const req = new Request('http://localhost:3000/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.email).toBe('demo-1@demo.syncpod.local');
    expect(data.user.name).toBe('Rizqi Pratama');

    expect(signIn).toHaveBeenCalledWith('demo-login', {
      email: 'demo-1@demo.syncpod.local',
      redirect: false,
    });
  });
});
