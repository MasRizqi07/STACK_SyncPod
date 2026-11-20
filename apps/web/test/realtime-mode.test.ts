import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRealtimeMode } from '../src/features/realtime/config';

describe('getRealtimeMode (D18 strict default real)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_REALTIME_MODE;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_REALTIME_MODE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_REALTIME_MODE = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_REALTIME_MODE;
    }
  });

  it('defaults to "real" when argument and env are undefined', () => {
    expect(getRealtimeMode()).toBe('real');
    expect(getRealtimeMode(undefined)).toBe('real');
  });

  it('returns "fake" only when raw value is exact lowercase string "fake"', () => {
    expect(getRealtimeMode('fake')).toBe('fake');
    process.env.NEXT_PUBLIC_REALTIME_MODE = 'fake';
    expect(getRealtimeMode()).toBe('fake');
  });

  it('returns "real" for uppercase "FAKE", boolean-like "true", and empty string ""', () => {
    expect(getRealtimeMode('FAKE')).toBe('real');
    expect(getRealtimeMode('true')).toBe('real');
    expect(getRealtimeMode('')).toBe('real');
    expect(getRealtimeMode('1')).toBe('real');
    expect(getRealtimeMode('null')).toBe('real');
  });

  it('returns "real" when process.env.NEXT_PUBLIC_REALTIME_MODE is unset or non-fake', () => {
    delete process.env.NEXT_PUBLIC_REALTIME_MODE;
    expect(getRealtimeMode()).toBe('real');

    process.env.NEXT_PUBLIC_REALTIME_MODE = 'FAKE';
    expect(getRealtimeMode()).toBe('real');

    process.env.NEXT_PUBLIC_REALTIME_MODE = 'true';
    expect(getRealtimeMode()).toBe('real');

    process.env.NEXT_PUBLIC_REALTIME_MODE = '';
    expect(getRealtimeMode()).toBe('real');
  });
});
