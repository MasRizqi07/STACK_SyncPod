import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SENTINEL_AUTH = 'SENTINEL_AUTH_SECRET_BUNDLE_SCAN_987654321';
const SENTINEL_REALTIME = 'SENTINEL_REALTIME_SECRET_BUNDLE_SCAN_12345';
const SENTINEL_DB_PASS = 'SENTINEL_DB_PASSWORD_NEVER_LEAK_777';
const SENTINEL_GEMINI = 'AIzaSyDUMMY_GEMINI_API_KEY_SERVER_ONLY_99999999';

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      out.push(full);
    }
  }
  return out;
}

console.log('=== Step 1: Building real mode web app with sentinel secrets ===');
execSync('pnpm --filter @syncpod/web build', {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_PUBLIC_REALTIME_MODE: 'real',
    DEMO_MODE: 'true',
    ALLOW_DEMO_IN_PROD: 'true',
    AUTH_SECRET: SENTINEL_AUTH,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME,
    DATABASE_URL: `postgresql://syncpod:${SENTINEL_DB_PASS}@localhost:5433/syncpod?schema=public`,
    GEMINI_API_KEY: SENTINEL_GEMINI,
    NO_COLOR: '1',
  },
  stdio: 'inherit',
});

console.log('\n=== Step 2: Scanning client static bundles (.next/static) for secrets ===');
const staticDir = path.join(REPO_ROOT, 'apps', 'web', '.next', 'static');
const staticFiles = walkFiles(staticDir);

if (staticFiles.length === 0) {
  throw new Error(`No client static bundle files found in ${staticDir}`);
}

console.log(`Auditing ${staticFiles.length} client bundle files...`);

const sentinels = [
  SENTINEL_AUTH,
  SENTINEL_REALTIME,
  SENTINEL_DB_PASS,
  SENTINEL_GEMINI,
];

const patterns = [
  { name: 'Google OAuth client secret (GOCSPX-)', regex: /GOCSPX-[A-Za-z0-9_-]+/ },
  { name: 'Google API Key (AIza...)', regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'Private Key header (-----BEGIN)', regex: /-----BEGIN/ },
];

const violations = [];

for (const file of staticFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');

  for (const sentinel of sentinels) {
    if (content.includes(sentinel)) {
      violations.push({ file: rel, issue: `Sentinel leak: ${sentinel.slice(0, 15)}...` });
    }
  }

  for (const { name, regex } of patterns) {
    if (regex.test(content)) {
      violations.push({ file: rel, issue: `Forbidden secret pattern: ${name}` });
    }
  }
}

console.log('\n=== Step 3: Auditing NEXT_PUBLIC_* environment variable names ===');
const FORBIDDEN_NAME_PATTERNS = [/SECRET/i, /KEY/i, /TOKEN/i, /PASSWORD/i, /PRIVATE/i];
const APPROVED_NEXT_PUBLIC_ALLOWLIST = new Set([
  'NEXT_PUBLIC_REALTIME_MODE',
  'NEXT_PUBLIC_REALTIME_URL',
]);

const envSourceFiles = [
  path.join(REPO_ROOT, 'apps', 'web', 'src', 'env.ts'),
  path.join(REPO_ROOT, 'apps', 'realtime', 'src', 'env.ts'),
];

for (const envFile of envSourceFiles) {
  const content = fs.readFileSync(envFile, 'utf8');
  const matches = content.matchAll(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g);
  for (const match of matches) {
    const varName = match[0];
    if (APPROVED_NEXT_PUBLIC_ALLOWLIST.has(varName)) {
      continue;
    }
    for (const pat of FORBIDDEN_NAME_PATTERNS) {
      if (pat.test(varName)) {
        violations.push({
          file: path.relative(REPO_ROOT, envFile),
          issue: `Dangerous NEXT_PUBLIC_* variable name exposes sensitive connotation: ${varName}`,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`FAIL: Detected ${violations.length} client bundle security violations:`);
  for (const v of violations) {
    console.error(`  - [${v.file}] ${v.issue}`);
  }
  process.exit(1);
}

console.log('PASS: Client bundles (.next/static) are completely clean of secrets and tokens:');
console.log('  ✓ Zero sentinel values found');
console.log('  ✓ Zero GOCSPX- Google secrets found');
console.log('  ✓ Zero AIza Google API keys found');
console.log('  ✓ Zero -----BEGIN private keys found');
console.log('  ✓ Zero dangerous NEXT_PUBLIC_* variable names');
console.log('\nClient bundle secret hygiene audit passed with 100% compliance.');
