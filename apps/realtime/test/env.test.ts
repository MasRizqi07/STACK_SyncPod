import { describe, expect, it } from 'vitest';
import { validateRealtimeEnv } from '../src/env.js';

const VALID_REALTIME_ENV = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5432/syncpod',
  REALTIME_JWT_SECRET: 'super-secret-realtime-jwt-key-32-bytes!',
  WEB_ORIGIN: 'http://localhost:3000',
  REALTIME_PORT: '4000',
  DEMO_MODE: 'true',
  ALLOW_DEMO_IN_PROD: 'false',
  GEMINI_MOCK: 'true',
};

describe('realtime env fail-fast validation (3.9)', () => {
  it('accepts valid realtime environment configuration', () => {
    const parsed = validateRealtimeEnv(VALID_REALTIME_ENV);
    expect(parsed.REALTIME_PORT).toBe(4000);
    expect(parsed.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(parsed.GEMINI_MODEL).toBe('gemini-3.8-flash');
  });

  it('fails fast when REALTIME_JWT_SECRET or DATABASE_URL is empty', () => {
    expect(() =>
      validateRealtimeEnv({
        ...VALID_REALTIME_ENV,
        REALTIME_JWT_SECRET: '',
      }),
    ).toThrow(/REALTIME_JWT_SECRET/);

    expect(() =>
      validateRealtimeEnv({
        ...VALID_REALTIME_ENV,
        DATABASE_URL: '',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects DEMO_MODE=true in production without ALLOW_DEMO_IN_PROD=true', () => {
    expect(() =>
      validateRealtimeEnv({
        ...VALID_REALTIME_ENV,
        NODE_ENV: 'production',
        DEMO_MODE: 'true',
        ALLOW_DEMO_IN_PROD: 'false',
      }),
    ).toThrow(/ALLOW_DEMO_IN_PROD/);
  });

  it('allows DEMO_MODE=true in production when ALLOW_DEMO_IN_PROD=true is explicitly set', () => {
    const parsed = validateRealtimeEnv({
      ...VALID_REALTIME_ENV,
      NODE_ENV: 'production',
      DEMO_MODE: 'true',
      ALLOW_DEMO_IN_PROD: 'true',
    });
    expect(parsed.ALLOW_DEMO_IN_PROD).toBe('true');
  });

  it('requires GEMINI_API_KEY when GEMINI_MOCK=false', () => {
    expect(() =>
      validateRealtimeEnv({
        ...VALID_REALTIME_ENV,
        GEMINI_MOCK: 'false',
        GEMINI_API_KEY: '',
      }),
    ).toThrow(/GEMINI_API_KEY/);
  });
});
