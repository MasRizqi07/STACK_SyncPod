import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const FORBIDDEN_NEXT_PUBLIC_PATTERN =
  /\bNEXT_PUBLIC_[A-Z0-9_]*(SECRET|KEY|PASSWORD|PASS|TOKEN|PRIVATE|DATABASE_URL|DSN)\b/g;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.env', '.example']);

function walkFiles(dir, result = []) {
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.next' ||
      entry === 'dist' ||
      entry === '.git' ||
      entry === 'proof'
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, result);
    } else {
      result.push(full);
    }
  }
  return result;
}

function walkStaticFiles(dir, result = []) {
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkStaticFiles(full, result);
    } else {
      result.push(full);
    }
  }
  return result;
}

let failures = 0;

console.log('=== SYNCPOD SECRET HYGIENE CHECK (Task 3.10) ===');

// 1. Verify .env is NOT tracked in git
const trackedEnv = execSync('git ls-files .env packages/db/.env apps/web/.env apps/realtime/.env', {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
if (trackedEnv.length > 0) {
  console.error(`FAIL: Tracked .env files found in git:\n${trackedEnv}`);
  failures += 1;
} else {
  console.log('PASS: Zero .env files tracked by git.');
}

// 2. Scan source tree & .env.example for forbidden NEXT_PUBLIC_* secret names
const filesToScan = [
  ...walkFiles(join(ROOT, 'apps')),
  ...walkFiles(join(ROOT, 'packages')),
  join(ROOT, '.env.example'),
].filter((f) => existsSync(f) && (SOURCE_EXTENSIONS.has(extname(f)) || f.endsWith('.env.example')));

const badNextPublic = [];
for (const file of filesToScan) {
  const text = readFileSync(file, 'utf8');
  const matches = text.match(FORBIDDEN_NEXT_PUBLIC_PATTERN);
  if (matches) {
    badNextPublic.push({ file: relative(ROOT, file), matches: [...new Set(matches)] });
  }
}

if (badNextPublic.length > 0) {
  console.error('FAIL: Forbidden NEXT_PUBLIC_* secret variable names detected:');
  for (const item of badNextPublic) {
    console.error(`  - ${item.file}: ${item.matches.join(', ')}`);
  }
  failures += 1;
} else {
  console.log(`PASS: Scanned ${filesToScan.length} source files; zero forbidden NEXT_PUBLIC_* secret names.`);
}

// 3. If apps/web/.next/static exists, scan client bundle for secret values
const staticDir = join(ROOT, 'apps', 'web', '.next', 'static');
const secretVars = ['AUTH_SECRET', 'REALTIME_JWT_SECRET', 'GEMINI_API_KEY'];
const activeSecrets = secretVars
  .map((name) => ({ name, value: process.env[name]?.trim() || '' }))
  .filter((entry) => entry.value.length >= 8);

if (existsSync(staticDir)) {
  const staticFiles = walkStaticFiles(staticDir);
  if (activeSecrets.length === 0) {
    console.log(
      `INFO: Scanned ${staticFiles.length} static assets (no env secret values set in current shell to search).`,
    );
  } else {
    const leaks = [];
    for (const file of staticFiles) {
      const content = readFileSync(file, 'utf8');
      for (const secret of activeSecrets) {
        if (content.includes(secret.value)) {
          leaks.push({ file: relative(ROOT, file), varName: secret.name });
        }
      }
    }
    if (leaks.length > 0) {
      console.error('FAIL: Secret values leaked into apps/web/.next/static:');
      for (const leak of leaks) {
        console.error(`  - ${leak.varName} found in ${leak.file}`);
      }
      failures += 1;
    } else {
      console.log(
        `PASS: Scanned ${staticFiles.length} built static assets in apps/web/.next/static; zero leaks for [${activeSecrets.map((s) => s.name).join(', ')}].`,
      );
    }
  }
} else {
  console.log('INFO: apps/web/.next/static not present yet; skipped static bundle scan.');
}

if (failures > 0) {
  console.error(`\nSECRET HYGIENE RESULT: FAIL (${failures} issue(s))`);
  process.exit(1);
}

console.log('\nSECRET HYGIENE RESULT: PASS');
