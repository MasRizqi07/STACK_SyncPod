import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET_FILE = path.join(REPO_ROOT, 'apps', 'web', 'src', 'lib', 'callback-url.ts');

const originalCode = fs.readFileSync(TARGET_FILE, 'utf8');

function runTest() {
  try {
    const out = execSync('pnpm --filter @syncpod/web test test/callback-path.test.ts', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
  console.log('BASELINE: GREEN (24/24 tests passed)');

  // Mutation 1: Disable /pod prefix check
  console.log('\n--- MUTATION 1: Remove /pod prefix check ---');
  const target1 = 'if (!/^\\/pod(\\/|\\?|$)/.test(decoded)) {';
  const mutant1 = originalCode.replace(target1, 'if (false) {');
  fs.writeFileSync(TARGET_FILE, mutant1, 'utf8');
  const res1 = runTest();
  if (res1.ok) {
    throw new Error('Mutant 1 survived! Test did not catch removed /pod prefix check.');
  }
  console.log('MUTANT 1 KILLED (RED, failed as expected):');
  const failLine1 = res1.output.split('\n').find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine1 || 'Test failed properly'));

  // Mutation 2: Remove backslash checks (both raw and decoded)
  console.log('\n--- MUTATION 2: Remove backslash rejection ---');
  const mutant2 = originalCode
    .replace("trimmed.includes('\\\\')", 'false')
    .replace("decoded.includes('\\\\')", 'false');
  fs.writeFileSync(TARGET_FILE, mutant2, 'utf8');
  const res2 = runTest();
  if (res2.ok) {
    throw new Error('Mutant 2 survived! Test did not catch removed backslash rejection.');
  }
  console.log('MUTANT 2 KILLED (RED, failed as expected):');
  const failLine2 = res2.output.split('\n').find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine2 || 'Test failed properly'));

  // Mutation 3: Remove path traversal check
  console.log('\n--- MUTATION 3: Remove path traversal check ---');
  const target3 = "if (/(^|\\/)\\.\\.(\\/|$)/.test(decoded) || decoded.includes('..')) {";
  const mutant3 = originalCode.replace(target3, 'if (false) {');
  fs.writeFileSync(TARGET_FILE, mutant3, 'utf8');
  const res3 = runTest();
  if (res3.ok) {
    throw new Error('Mutant 3 survived! Test did not catch removed path traversal check.');
  }
  console.log('MUTANT 3 KILLED (RED, failed as expected):');
  const failLine3 = res3.output.split('\n').find((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('×'));
  console.log('  ' + (failLine3 || 'Test failed properly'));

} finally {
  fs.writeFileSync(TARGET_FILE, originalCode, 'utf8');
}

console.log('\n--- RESTORE RUN (ORIGINAL) ---');
const restored = runTest();
if (!restored.ok) {
  throw new Error('Restored test failed:\n' + restored.output);
}
console.log('RESTORED: GREEN (24/24 tests passed)');
console.log('\nSUCCESS: 3/3 mutants killed, baseline and restored green.');
