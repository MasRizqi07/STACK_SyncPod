#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const CONFIG_PATH = path.join(__dirname, 'mutation', 'targets.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`ERROR: Mutation targets config not found at ${CONFIG_PATH}`);
  process.exit(1);
}

const targets = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

console.log('===============================================================');
console.log(' CONFIG-DRIVEN SECURITY MUTATION TESTING HARNESS (C5, D38-D40)');
console.log('===============================================================\n');

const results = [];
let totalMutants = 0;
let totalKilled = 0;
let totalSurvived = 0;

for (const target of targets) {
  const filePath = path.join(REPO_ROOT, target.file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Target file not found: ${filePath}`);
    process.exit(1);
  }

  const originalContent = fs.readFileSync(filePath, 'utf8');
  console.log(`\n>>> Testing Module: ${target.module} (${target.file})`);
  console.log(`    Behaviors protected: ${target.behaviors.length}`);
  target.behaviors.forEach((b) => console.log(`      - ${b}`));
  console.log(`    Test command: ${target.testCommand}`);

  let killed = 0;
  let survived = 0;
  const mutantDetails = [];

  for (const mutant of target.mutants) {
    totalMutants += 1;
    let mutatedContent;

    if (!originalContent.includes(mutant.find)) {
      console.error(`    [CONFIG ERROR] Mutant ${mutant.id}: Pattern not found in ${target.file}`);
      console.error(`    Pattern sought:\n${mutant.find}`);
      process.exit(1);
    }

    mutatedContent = originalContent.replace(mutant.find, mutant.replace);

    let wasKilled = false;
    let failureOutput = '';

    try {
      fs.writeFileSync(filePath, mutatedContent, 'utf8');

      // Run test command; if it throws, the test failed as expected -> mutant killed!
      try {
        execSync(target.testCommand, {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          stdio: 'pipe',
          env: {
            ...process.env,
            NODE_ENV: 'test',
            NEXT_PUBLIC_REALTIME_MODE: 'real',
            DEMO_MODE: 'true',
            DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5433/syncpod_test?schema=public',
            NO_COLOR: '1',
          },
        });
        // Test passed unexpectedly -> Mutant survived!
        wasKilled = false;
      } catch (err) {
        wasKilled = true;
        failureOutput = err.stderr || err.stdout || err.message;
      }
    } finally {
      // Always restore file in finally
      fs.writeFileSync(filePath, originalContent, 'utf8');
    }

    if (wasKilled) {
      killed += 1;
      totalKilled += 1;
      console.log(`    ✓ KILLED:   ${mutant.id} - ${mutant.description}`);
      mutantDetails.push({ id: mutant.id, status: 'KILLED', desc: mutant.description });
    } else {
      survived += 1;
      totalSurvived += 1;
      console.error(`    ✗ SURVIVED: ${mutant.id} - ${mutant.description}`);
      mutantDetails.push({ id: mutant.id, status: 'SURVIVED', desc: mutant.description });
    }
  }

  results.push({
    module: target.module,
    file: target.file,
    behaviors: target.behaviors,
    mutantsCount: target.mutants.length,
    killed,
    survived,
    mutantDetails,
  });
}

// Final git integrity check: ensure no source files remain modified
console.log('\n--- Checking working tree cleanliness after mutation check ---');
const gitStatus = execSync('git status --porcelain', {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});

// Filter to check if any of our mutated files are in git status
const targetFileSet = new Set(targets.map((t) => t.file.replace(/\\/g, '/')));
const lingeringFiles = gitStatus
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.slice(3).trim().replace(/\\/g, '/'))
  .filter((f) => targetFileSet.has(f));

if (lingeringFiles.length > 0) {
  console.error(`FATAL: Lingering modifications detected in target files: ${lingeringFiles.join(', ')}`);
  process.exit(1);
}
console.log('✓ All target files cleanly restored to original state.\n');

// Summary table
console.log('===============================================================');
console.log(' MUTATION TEST RESULTS SUMMARY');
console.log('===============================================================');
console.log('| Module | Behaviors Tested | Mutants | Killed | Survived | Rate |');
console.log('|---|---|---|---|---|---|');
for (const r of results) {
  const rate = ((r.killed / r.mutantsCount) * 100).toFixed(0);
  console.log(`| ${r.module} | ${r.behaviors.length} behaviors | ${r.mutantsCount} | ${r.killed} | ${r.survived} | ${rate}% |`);
}
console.log('---------------------------------------------------------------');
console.log(`TOTAL: ${totalMutants} mutants | ${totalKilled} killed | ${totalSurvived} survived | ${((totalKilled / totalMutants) * 100).toFixed(0)}% kill rate\n`);

if (totalSurvived > 0) {
  console.error(`MUTATION CHECK FAILED: ${totalSurvived} mutant(s) survived! Add tests for uncovered behavior.`);
  process.exit(1);
} else {
  console.log('ALL MUTANTS KILLED. Test suite exhibits high fault-detection sensitivity.');
  process.exit(0);
}
