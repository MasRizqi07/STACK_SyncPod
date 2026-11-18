import { describe, expect, it } from 'vitest';
import { db } from '@syncpod/db';
import { auth } from '../src/auth';
import {
  getSessionCookieName,
  isAllowedEmailDomain,
  isBotEmail,
  isSecureRequest,
  isSeededDemoEmail,
} from '../src/lib/auth-rules';

describe('Auth.js configuration and credentials authorization (3.4)', () => {
  it('exposes auth handler and supports credentials authorization for seeded demo users', async () => {
    expect(typeof auth).toBe('function');

    const user = await db.user.upsert({
      where: { email: 'demo-1@demo.syncpod.local' },
      update: { name: 'Rizqi Pratama' },
      create: {
        email: 'demo-1@demo.syncpod.local',
        name: 'Rizqi Pratama',
      },
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('demo-1@demo.syncpod.local');
  });

  it('rejects bot emails via production isBotEmail rule (D8)', () => {
    expect(isBotEmail('simulasi-1@bot.syncpod.local')).toBe(true);
    expect(isBotEmail('SIMULASI-2@BOT.SYNCPOD.LOCAL')).toBe(true);
    expect(isBotEmail('simulasi-3@bot.syncpod.local')).toBe(true);
    expect(isBotEmail('demo-1@demo.syncpod.local')).toBe(false);
  });

  it('rejects unseeded and arbitrary emails via production isSeededDemoEmail rule (D10)', () => {
    expect(isSeededDemoEmail('demo-1@demo.syncpod.local')).toBe(true);
    expect(isSeededDemoEmail('DEMO-4@demo.syncpod.local')).toBe(true);
    expect(isSeededDemoEmail('demo-5@demo.syncpod.local')).toBe(false);
    expect(isSeededDemoEmail('attacker@example.com')).toBe(false);
    expect(isSeededDemoEmail('student@mhs.itats.ac.id')).toBe(false);
  });

  it('enforces ALLOWED_EMAIL_DOMAINS via production isAllowedEmailDomain rule', () => {
    expect(isAllowedEmailDomain('student@itats.ac.id', 'itats.ac.id,mhs.itats.ac.id')).toBe(true);
    expect(isAllowedEmailDomain('user@gmail.com', 'itats.ac.id,mhs.itats.ac.id')).toBe(false);
    expect(isAllowedEmailDomain('anyone@gmail.com', '')).toBe(true);
    expect(isAllowedEmailDomain('invalid-email', 'itats.ac.id')).toBe(false);
  });

  it('selects protocol-aware cookie name for HTTP LAN vs HTTPS production', () => {
    const httpReq = new Request('http://192.168.1.10:3000/pod');
    const httpsReq = new Request('https://syncpod.example.com/pod');
    const proxiedHttpsReq = new Request('http://127.0.0.1:3000/pod', {
      headers: { 'x-forwarded-proto': 'https' },
    });

    expect(isSecureRequest(httpReq)).toBe(false);
    expect(getSessionCookieName(false)).toBe('authjs.session-token');
    expect(isSecureRequest(httpsReq)).toBe(true);
    expect(isSecureRequest(proxiedHttpsReq)).toBe(true);
    expect(getSessionCookieName(true)).toBe('__Secure-authjs.session-token');
  });
});
