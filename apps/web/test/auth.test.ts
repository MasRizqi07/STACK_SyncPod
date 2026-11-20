import { describe, expect, it } from 'vitest';
import { db } from '@syncpod/db';
import { auth } from '../src/auth';
import {
  isAllowedGoogleSignIn,
  isBotEmail,
  isDemoLoginEmail,
} from '../src/lib/auth-policy';

describe('Auth policy and configuration (X3, D33, D34)', () => {
  it('exposes auth handler and validates demo user persistence in db', async () => {
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

  describe('isDemoLoginEmail (table-driven against DEMO_ACCOUNTS)', () => {
    const cases = [
      { email: 'demo-1@demo.syncpod.local', expected: true, desc: 'exact demo-1' },
      { email: 'demo-2@demo.syncpod.local', expected: true, desc: 'exact demo-2' },
      { email: 'demo-3@demo.syncpod.local', expected: true, desc: 'exact demo-3' },
      { email: 'demo-4@demo.syncpod.local', expected: true, desc: 'exact demo-4' },
      { email: 'DEMO-1@DEMO.SYNCPOD.LOCAL', expected: true, desc: 'uppercase demo-1' },
      { email: '  demo-2@demo.syncpod.local  ', expected: true, desc: 'trimmed demo-2' },
      { email: 'demo-5@demo.syncpod.local', expected: false, desc: 'unseeded demo-5' },
      { email: 'simulasi-1@bot.syncpod.local', expected: false, desc: 'bot email rejected' },
      { email: 'student@mhs.itats.ac.id', expected: false, desc: 'real student email rejected' },
      { email: 'attacker@evil.com', expected: false, desc: 'arbitrary email rejected' },
      { email: '', expected: false, desc: 'empty string' },
      { email: null, expected: false, desc: 'null email' },
      { email: undefined, expected: false, desc: 'undefined email' },
    ];

    for (const { email, expected, desc } of cases) {
      it(`evaluates ${desc}`, () => {
        expect(isDemoLoginEmail(email)).toBe(expected);
      });
    }
  });

  describe('isBotEmail (table-driven against BOT_ACCOUNTS and D8)', () => {
    const cases = [
      { email: 'simulasi-1@bot.syncpod.local', expected: true, desc: 'seeded bot 1' },
      { email: 'simulasi-2@bot.syncpod.local', expected: true, desc: 'seeded bot 2' },
      { email: 'simulasi-3@bot.syncpod.local', expected: true, desc: 'seeded bot 3' },
      { email: 'SIMULASI-1@BOT.SYNCPOD.LOCAL', expected: true, desc: 'uppercase bot' },
      { email: '  simulasi-2@bot.syncpod.local  ', expected: true, desc: 'trimmed bot' },
      { email: 'simulasi-99@bot.syncpod.local', expected: true, desc: 'bot domain' },
      { email: 'custom-bot@bot.syncpod.local', expected: true, desc: 'bot domain without simulasi prefix' },
      { email: 'simulasi-other@example.com', expected: true, desc: 'simulasi prefix' },
      { email: 'demo-1@demo.syncpod.local', expected: false, desc: 'demo account is not bot' },
      { email: 'student@itats.ac.id', expected: false, desc: 'student is not bot' },
      { email: '', expected: false, desc: 'empty string' },
      { email: null, expected: false, desc: 'null email' },
      { email: undefined, expected: false, desc: 'undefined email' },
    ];

    for (const { email, expected, desc } of cases) {
      it(`evaluates ${desc}`, () => {
        expect(isBotEmail(email)).toBe(expected);
      });
    }
  });

  describe('isAllowedGoogleSignIn (table-driven Google sign-in policy)', () => {
    const cases = [
      {
        params: {
          email: 'student@itats.ac.id',
          emailVerified: true,
          allowedDomainsCsv: 'itats.ac.id,mhs.itats.ac.id',
        },
        expected: true,
        desc: 'verified email matching allowed domain',
      },
      {
        params: {
          email: 'STUDENT@MHS.ITATS.AC.ID',
          emailVerified: true,
          allowedDomainsCsv: 'itats.ac.id,mhs.itats.ac.id',
        },
        expected: true,
        desc: 'case-insensitive verified email matching second domain',
      },
      {
        params: {
          email: 'student@itats.ac.id',
          emailVerified: false,
          allowedDomainsCsv: 'itats.ac.id',
        },
        expected: false,
        desc: 'unverified email rejected even if domain matches (D34/X3 security rule)',
      },
      {
        params: {
          email: 'student@itats.ac.id',
          emailVerified: null,
          allowedDomainsCsv: 'itats.ac.id',
        },
        expected: false,
        desc: 'null emailVerified rejected',
      },
      {
        params: {
          email: 'outsider@gmail.com',
          emailVerified: true,
          allowedDomainsCsv: 'itats.ac.id,mhs.itats.ac.id',
        },
        expected: false,
        desc: 'verified email not in allowed domains list',
      },
      {
        params: {
          email: 'anyone@gmail.com',
          emailVerified: true,
          allowedDomainsCsv: '',
        },
        expected: true,
        desc: 'empty allowedDomainsCsv permits any verified email',
      },
      {
        params: {
          email: 'anyone@gmail.com',
          emailVerified: true,
          allowedDomainsCsv: undefined,
        },
        expected: true,
        desc: 'undefined allowedDomainsCsv permits any verified email',
      },
      {
        params: {
          email: 'not-an-email',
          emailVerified: true,
          allowedDomainsCsv: 'itats.ac.id',
        },
        expected: false,
        desc: 'malformed email without @ rejected',
      },
      {
        params: {
          email: null,
          emailVerified: true,
          allowedDomainsCsv: 'itats.ac.id',
        },
        expected: false,
        desc: 'null email rejected',
      },
    ];

    for (const { params, expected, desc } of cases) {
      it(`evaluates ${desc}`, () => {
        expect(isAllowedGoogleSignIn(params)).toBe(expected);
      });
    }
  });
});
