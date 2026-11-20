import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskSensitiveData } from './proof-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.AUTH_MATRIX_PORT || 3125);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = process.env.AUTH_SECRET || 'super-secret-auth-key-32-chars-min!!';
const REALTIME_JWT_SECRET = process.env.REALTIME_JWT_SECRET || 'different-realtime-jwt-secret-32-chars!';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://syncpod:syncpod@localhost:5433/syncpod?schema=public';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function main() {
  console.log(`Starting Next.js production server for auth-matrix on port ${PORT}...`);
  const child = spawn(
    'pnpm',
    ['--filter', '@syncpod/web', 'exec', 'next', 'start', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: REPO_ROOT,
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_REALTIME_MODE: 'real',
        DEMO_MODE: 'true',
        ALLOW_DEMO_IN_PROD: 'true',
        AUTH_SECRET,
        REALTIME_JWT_SECRET,
        DATABASE_URL,
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.on('data', (c) => (stderr += c.toString()));

  const cleanup = async () => {
    if (child.pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          try { child.kill('SIGKILL'); } catch {}
        }
      } else {
        try { child.kill('SIGKILL'); } catch {}
      }
    }
    await wait(500);
  };

  try {
    await waitForServer(`${BASE_URL}/masuk`);
    console.log('Server ready for auth matrix verification.\n');

    const results = [];

    // Check 1: Bot rejection
    console.log('CHECK 1: Bot account rejection');
    const res1 = await fetch(`${BASE_URL}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'simulasi-1@bot.syncpod.local' }),
    });
    const body1 = await res1.json();
    console.log(`  Request:  POST /api/demo/login { email: "simulasi-1@bot.syncpod.local" }`);
    console.log(`  Response: HTTP ${res1.status} -> ${JSON.stringify(body1)}`);
    if (res1.status !== 403 || body1.error?.code !== 'FORBIDDEN') {
      throw new Error(`Expected 403 FORBIDDEN for bot, got ${res1.status}`);
    }
    console.log('  Result:   PASS\n');
    results.push('CHECK 1 (bot rejection): PASS');

    // Check 2: Arbitrary email rejection
    console.log('CHECK 2: Arbitrary email rejection');
    const res2 = await fetch(`${BASE_URL}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'random@example.com' }),
    });
    const body2 = await res2.json();
    console.log(`  Request:  POST /api/demo/login { email: "random@example.com" }`);
    console.log(`  Response: HTTP ${res2.status} -> ${JSON.stringify(body2)}`);
    if (res2.status !== 403 || body2.error?.code !== 'FORBIDDEN') {
      throw new Error(`Expected 403 FORBIDDEN for arbitrary email, got ${res2.status}`);
    }
    console.log('  Result:   PASS\n');
    results.push('CHECK 2 (arbitrary email rejection): PASS');

    // Check 3: Valid demo account login (demo-1..4)
    for (let i = 1; i <= 4; i += 1) {
      const email = `demo-${i}@demo.syncpod.local`;
      console.log(`CHECK 3.${i}: Valid demo account login (${email})`);
      const res = await fetch(`${BASE_URL}/api/demo/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      const sessionCookie = cookies.find((c) => c && c.includes('session-token')) || '';
      console.log(`  Request:  POST /api/demo/login { email: "${email}" }`);
      console.log(`  Response: HTTP ${res.status} -> ok=${body.ok}, user=${body.user?.email}`);
      console.log(`  ${maskSensitiveData(`Set-Cookie: ${sessionCookie}`)}`);

      if (res.status !== 200 || !body.ok || body.user?.email !== email) {
        throw new Error(`Expected 200 ok for ${email}, got ${res.status}`);
      }
      if (!sessionCookie.toLowerCase().includes('httponly')) {
        throw new Error(`Missing HttpOnly attribute in session cookie for ${email}`);
      }
      console.log('  Result:   PASS\n');
      results.push(`CHECK 3.${i} (${email}): PASS`);
    }

    console.log('=== AUTH MATRIX VERIFICATION SUMMARY ===');
    results.forEach((r) => console.log(`✓ ${r}`));
    console.log('\nALL AUTH MATRIX CHECKS PASSED SUCCESSFULLY.');
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
