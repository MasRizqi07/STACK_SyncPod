import { describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache, validateWebEnv } from '../src/env';

const VALID_REAL_ENV = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_REALTIME_MODE: 'real',
  NEXT_PUBLIC_REALTIME_URL: 'http://localhost:4000',
  DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5432/syncpod',
  AUTH_SECRET: 'super-secret-auth-key-32-bytes-minimum!',
  REALTIME_JWT_SECRET: 'super-secret-realtime-jwt-key-32-bytes!',
  DEMO_MODE: 'true',
  ALLOW_DEMO_IN_PROD: 'false',
};

describe('web env fail-fast validation (3.9, D40)', () => {
  it('accepts valid real-mode configuration in development', () => {
    const parsed = validateWebEnv(VALID_REAL_ENV);
    expect(parsed.NEXT_PUBLIC_REALTIME_MODE).toBe('real');
    expect(parsed.DEMO_MODE).toBe('true');
  });

  it('fails fast when AUTH_SECRET or REALTIME_JWT_SECRET is shorter than 32 characters', () => {
    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        AUTH_SECRET: 'short-secret-under-32-bytes',
      }),
    ).toThrow(/AUTH_SECRET/);

    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        REALTIME_JWT_SECRET: 'short-secret-under-32-bytes',
      }),
    ).toThrow(/REALTIME_JWT_SECRET/);
  });

  it('rejects identical AUTH_SECRET and REALTIME_JWT_SECRET (D39, D40)', () => {
    const identicalSecret = 'same-shared-secret-32-bytes-should-fail!';
    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        AUTH_SECRET: identicalSecret,
        REALTIME_JWT_SECRET: identicalSecret,
      }),
    ).toThrow(/REALTIME_JWT_SECRET must not be identical to AUTH_SECRET/);
  });

  it('enforces Google OAuth credentials pair: both present or both absent', () => {
    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        AUTH_GOOGLE_ID: 'google-client-id-123.apps.googleusercontent.com',
        AUTH_GOOGLE_SECRET: '',
      }),
    ).toThrow(/AUTH_GOOGLE_SECRET/);

    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        AUTH_GOOGLE_ID: '',
        AUTH_GOOGLE_SECRET: 'GOCSPX-secret123',
      }),
    ).toThrow(/AUTH_GOOGLE_ID/);

    const withBoth = validateWebEnv({
      ...VALID_REAL_ENV,
      AUTH_GOOGLE_ID: 'google-client-id-123.apps.googleusercontent.com',
      AUTH_GOOGLE_SECRET: 'GOCSPX-secret123',
    });
    expect(withBoth.AUTH_GOOGLE_ID).toBe('google-client-id-123.apps.googleusercontent.com');
  });

  it('rejects DEMO_MODE=true in production without ALLOW_DEMO_IN_PROD=true', () => {
    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        NODE_ENV: 'production',
        DEMO_MODE: 'true',
        ALLOW_DEMO_IN_PROD: 'false',
      }),
    ).toThrow(/ALLOW_DEMO_IN_PROD/);
  });

  it('allows DEMO_MODE=true in production when ALLOW_DEMO_IN_PROD=true is explicitly set', () => {
    const parsed = validateWebEnv({
      ...VALID_REAL_ENV,
      NODE_ENV: 'production',
      DEMO_MODE: 'true',
      ALLOW_DEMO_IN_PROD: 'true',
    });
    expect(parsed.DEMO_MODE).toBe('true');
    expect(parsed.ALLOW_DEMO_IN_PROD).toBe('true');
  });

  it('allows fake prototype mode without any database or auth secrets (D18, D40)', () => {
    const parsed = validateWebEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'fake',
    });
    expect(parsed.NEXT_PUBLIC_REALTIME_MODE).toBe('fake');
    expect(parsed.AUTH_SECRET).toBeUndefined();
    expect(parsed.DATABASE_URL).toBeUndefined();
  });

  it('memoizes environment validation result via getEnv()', () => {
    resetEnvCache();
    const env1 = getEnv();
    const env2 = getEnv();
    expect(env1).toBe(env2);
  });
});
