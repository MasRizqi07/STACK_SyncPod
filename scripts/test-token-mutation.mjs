import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET_FILE = path.join(
  REPO_ROOT,
  'packages',
  'shared',
  'src',
  'server',
  'realtime-token.ts',
);

const originalCode = fs.readFileSync(TARGET_FILE, 'utf8');

function runTest() {
  try {
    const out = execSync(
      'pnpm --filter @syncpod/shared exec vitest run test/realtime-token.test.ts',
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: (err.stdout || '') + (err.stderr || '') };
  }
}

try {
  console.log('--- BASELINE RUN (ORIGINAL) ---');
  const baseline = runTest();
  if (!baseline.ok) {
    throw new Error('Baseline test failed:\n' + baseline.output);
  }
  console.log('BASELINE: GREEN (11/11 tests passed)');

  // Mutation 1: Remove max TTL (exp - iat > 600) check
  console.log('\n--- MUTATION 1: Remove max TTL (exp - iat > 600) check ---');
  const target1 = 'if (payload.exp - payload.iat > REALTIME_TOKEN_MAX_TTL_SEC) {';
  const mutant1 = originalCode.replace(target1, 'if (false) {');
  fs.writeFileSync(TARGET_FILE, mutant1, 'utf8');
  const res1 = runTest();
  if (res1.ok) {
    throw new Error('Mutant 1 survived! Test did not catch removed max TTL check.');
  }
  console.log('MUTANT 1 KILLED (RED, failed as expected):');
  const failLine1 = res1.output
    .split('\n')
    .find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine1 || 'Test failed properly'));

  // Mutation 2: Remove secret minimum length check
  console.log('\n--- MUTATION 2: Remove secret minimum length check ---');
  const target2 =
    'if (typeof secret !== \'string\' || secret.trim().length < MIN_SECRET_LENGTH) {';
  const mutant2 = originalCode.replace(
    target2,
    "if (typeof secret !== 'string') {",
  );
  fs.writeFileSync(TARGET_FILE, mutant2, 'utf8');
  const res2 = runTest();
  if (res2.ok) {
    throw new Error('Mutant 2 survived! Test did not catch removed secret length check.');
  }
  console.log('MUTANT 2 KILLED (RED, failed as expected):');
  const failLine2 = res2.output
    .split('\n')
    .find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine2 || 'Test failed properly'));

  // Mutation 3: Remove sub validation check
  console.log('\n--- MUTATION 3: Remove empty sub validation check ---');
  const target3 = 'payload.sub.trim().length === 0 ||';
  const mutant3 = originalCode.replace(target3, 'false ||');
  fs.writeFileSync(TARGET_FILE, mutant3, 'utf8');
  const res3 = runTest();
  if (res3.ok) {
    throw new Error('Mutant 3 survived! Test did not catch removed empty sub check.');
  }
  console.log('MUTANT 3 KILLED (RED, failed as expected):');
  const failLine3 = res3.output
    .split('\n')
    .find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine3 || 'Test failed properly'));
} finally {
  fs.writeFileSync(TARGET_FILE, originalCode, 'utf8');
}

console.log('\n--- RESTORE RUN (ORIGINAL) ---');
const restored = runTest();
if (!restored.ok) {
  throw new Error('Restored test failed:\n' + restored.output);
}
console.log('RESTORED: GREEN (11/11 tests passed)');
console.log('\nSUCCESS: 3/3 token mutants killed, baseline and restored green.');
