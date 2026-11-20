import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_TOKENS = [
  'next-auth',
  '@auth/core',
  'authjs',
  '@prisma/client',
  'PrismaClient',
  'jose',
  'SignJWT',
  'jwtVerify',
];

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

if (process.env.SKIP_BUILD === '1') {
  console.log('=== Step 1: Skipping build (SKIP_BUILD=1 specified) ===');
} else {
  console.log('=== Step 1: Building web app in fake prototype mode (NEXT_PUBLIC_REALTIME_MODE=fake) ===');
  execSync('pnpm --filter @syncpod/web build', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'fake',
      DEMO_MODE: 'false',
      NO_COLOR: '1',
    },
    stdio: 'inherit',
  });
}

console.log('\n=== Step 2: Scanning client static bundles (.next/static) for forbidden auth/db/jose symbols ===');
const staticDir = path.join(REPO_ROOT, 'apps', 'web', '.next', 'static');
const files = walkFiles(staticDir);

if (files.length === 0) {
  throw new Error(`No client static bundle files found in ${staticDir}`);
}

console.log(`Auditing ${files.length} client static files...`);

const leaks = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (content.includes(token)) {
      leaks.push({
        file: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
        token,
      });
    }
  }
}

if (leaks.length > 0) {
  console.error('FAIL: Leaked forbidden auth/db/jose symbols in fake mode client bundle:');
  for (const leak of leaks) {
    console.error(`  - [${leak.token}] in ${leak.file}`);
  }
  process.exit(1);
}

console.log('PASS: Zero occurrences of forbidden tokens in fake client bundle:');
for (const token of FORBIDDEN_TOKENS) {
  console.log(`  ✓ ${token}: 0 hits`);
}
console.log('\nFake client bundle is completely isolated from auth, prisma, and jose.');
