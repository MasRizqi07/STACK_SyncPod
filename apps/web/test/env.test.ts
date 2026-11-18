import { describe, expect, it } from 'vitest';
import { validateWebEnv } from '../src/env';

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

describe('web env fail-fast validation (3.9)', () => {
  it('accepts valid real-mode configuration in development', () => {
    const parsed = validateWebEnv(VALID_REAL_ENV);
    expect(parsed.NEXT_PUBLIC_REALTIME_MODE).toBe('real');
    expect(parsed.DEMO_MODE).toBe('true');
  });

  it('fails fast when AUTH_SECRET or REALTIME_JWT_SECRET is empty in real mode', () => {
    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        AUTH_SECRET: '',
      }),
    ).toThrow(/AUTH_SECRET/);

    expect(() =>
      validateWebEnv({
        ...VALID_REAL_ENV,
        REALTIME_JWT_SECRET: '',
      }),
    ).toThrow(/REALTIME_JWT_SECRET/);
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

  it('allows fake prototype mode without server secrets (D18)', () => {
    const parsed = validateWebEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'fake',
    });
    expect(parsed.NEXT_PUBLIC_REALTIME_MODE).toBe('fake');
  });
});
