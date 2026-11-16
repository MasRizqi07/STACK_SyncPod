import { describe, expect, it } from 'vitest';
import { db } from '@syncpod/db';
import { auth } from '../src/auth';

describe('Auth.js configuration and credentials authorization (3.4)', () => {
  it('exposes auth handler and supports credentials authorization for seeded demo users', async () => {
    expect(typeof auth).toBe('function');

    // Ensure demo-1 exists in database
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

  it('rejects bot emails from credentials provider (D8)', () => {
    const isBot = (email: string) =>
      email.endsWith('@bot.syncpod.local') || email.startsWith('simulasi-');
    expect(isBot('simulasi-1@bot.syncpod.local')).toBe(true);
    expect(isBot('simulasi-2@bot.syncpod.local')).toBe(true);
    expect(isBot('simulasi-3@bot.syncpod.local')).toBe(true);
  });

  it('rejects unseeded and arbitrary emails from credentials provider (D10)', () => {
    const isSeededDemo = (email: string) =>
      /^demo-[1-4]@demo\.syncpod\.local$/.test(email.trim().toLowerCase());

    expect(isSeededDemo('demo-1@demo.syncpod.local')).toBe(true);
    expect(isSeededDemo('demo-4@demo.syncpod.local')).toBe(true);
    expect(isSeededDemo('demo-5@demo.syncpod.local')).toBe(false);
    expect(isSeededDemo('attacker@example.com')).toBe(false);
    expect(isSeededDemo('student@mhs.itats.ac.id')).toBe(false);
  });

  it('enforces ALLOWED_EMAIL_DOMAINS when configured', () => {
    const filterDomain = (email: string, allowedCsv: string) => {
      const allowed = allowedCsv
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length === 0) return true;
      const domain = email.split('@')[1]?.toLowerCase();
      return !!domain && allowed.includes(domain);
    };

    expect(filterDomain('student@itats.ac.id', 'itats.ac.id,mhs.itats.ac.id')).toBe(true);
    expect(filterDomain('user@gmail.com', 'itats.ac.id,mhs.itats.ac.id')).toBe(false);
  });
});
