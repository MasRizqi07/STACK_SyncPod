import { describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache, validateRealtimeEnv } from '../src/env.js';

const VALID_REALTIME_ENV = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5432/syncpod',
  REALTIME_JWT_SECRET: 'super-secret-realtime-jwt-key-32-bytes!',
  WEB_ORIGIN: 'http://localhost:3000',
  REALTIME_PORT: '4000',
  DEMO_MODE: 'true',
  ALLOW_DEMO_IN_PROD: 'false',
};

describe('realtime env fail-fast validation (3.9, D40)', () => {
  it('accepts valid realtime environment configuration', () => {
    const parsed = validateRealtimeEnv(VALID_REALTIME_ENV);
    expect(parsed.REALTIME_PORT).toBe(4000);
    expect(parsed.WEB_ORIGIN).toBe('http://localhost:3000');
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

  it('rejects REALTIME_JWT_SECRET shorter than 32 characters', () => {
    expect(() =>
      validateRealtimeEnv({
        ...VALID_REALTIME_ENV,
        REALTIME_JWT_SECRET: 'short-secret-under-32-bytes',
      }),
    ).toThrow(/REALTIME_JWT_SECRET/);
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

  it('memoizes environment validation result via getEnv()', () => {
    resetEnvCache();
    const origDb = process.env.DATABASE_URL;
    const origSecret = process.env.REALTIME_JWT_SECRET;
    try {
      process.env.DATABASE_URL = 'postgresql://syncpod:syncpod@localhost:5432/syncpod';
      process.env.REALTIME_JWT_SECRET = 'super-secret-realtime-jwt-key-32-bytes!';
      const env1 = getEnv();
      const env2 = getEnv();
      expect(env1).toBe(env2);
    } finally {
      process.env.DATABASE_URL = origDb;
      process.env.REALTIME_JWT_SECRET = origSecret;
      resetEnvCache();
    }
  });
});
