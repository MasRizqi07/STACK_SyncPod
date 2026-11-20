import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    conditions: ['development'],
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'next/server': require.resolve('next/server.js'),
    },
  },
  test: {
    globalSetup: [path.resolve(import.meta.dirname, '../../packages/db/test/global-setup.ts')],
    server: {
      deps: {
        inline: [/next-auth/],
      },
    },
  },
});
