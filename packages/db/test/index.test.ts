import { describe, expect, it } from 'vitest';
import { readDatabaseConfig } from '../src/index.js';

describe('readDatabaseConfig', () => {
  it('returns trimmed DATABASE_URL when set', () => {
    const config = readDatabaseConfig({
      DATABASE_URL: '  postgresql://syncpod:syncpod@localhost:5432/syncpod  ',
    });
    expect(config).toEqual({
      url: 'postgresql://syncpod:syncpod@localhost:5432/syncpod',
    });
  });

  it('throws when DATABASE_URL is missing or empty', () => {
    expect(() => readDatabaseConfig({})).toThrow('DATABASE_URL environment variable is required');
    expect(() => readDatabaseConfig({ DATABASE_URL: '   ' })).toThrow(
      'DATABASE_URL environment variable is required',
    );
  });
});

