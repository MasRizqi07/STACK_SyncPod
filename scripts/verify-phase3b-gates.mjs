import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const AUTH_SECRET = 'gate-verification-auth-secret-32-chars!!';
const REALTIME_JWT_SECRET = 'gate-verification-realtime-secret-32-c!';
const DATABASE_URL = 'postgresql://syncpod:syncpod@localhost:5433/syncpod?schema=public';

function runStep(title, cmd, envOverrides = {}) {
  console.log(`\n=== Gate: ${title} ===`);
  console.log(`$ ${cmd}`);
  execSync(cmd, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      DATABASE_URL,
      AUTH_SECRET,
      REALTIME_JWT_SECRET,
      ...envOverrides,
    },
    stdio: 'inherit',
  });
  console.log(`✓ ${title} PASSED`);
}

async function main() {
  console.log('=== PHASE 3B COMPREHENSIVE WORKSPACE GATES (G1) ===\n');

  // 1. Recursive typecheck
  runStep('Recursive Typecheck (pnpm -r typecheck)', 'pnpm -r typecheck');

  // 2. Recursive lint
  runStep('Recursive Lint (pnpm -r lint)', 'pnpm -r lint');

  // 3. Recursive test
  runStep('Recursive Test (pnpm -r test)', 'pnpm -r test');

  // 4. Build in fake mode
  runStep(
    'Build in Fake Mode (NEXT_PUBLIC_REALTIME_MODE=fake)',
    'pnpm -r build',
    {
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'fake',
      DEMO_MODE: 'false',
    },
  );

  // 5. Build in real mode
  runStep(
    'Build in Real Mode (NEXT_PUBLIC_REALTIME_MODE=real)',
    'pnpm -r build',
    {
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'real',
      DEMO_MODE: 'true',
      ALLOW_DEMO_IN_PROD: 'true',
    },
  );

  console.log('\nALL WORKSPACE GATES PASSED WITH ZERO ERRORS!');
}

main().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
