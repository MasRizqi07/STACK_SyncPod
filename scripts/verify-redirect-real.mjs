import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const PORT = 3133;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = 'super-secret-auth-key-32-chars-min!!';
const REALTIME_JWT_SECRET = 'different-realtime-jwt-secret-32-chars!';

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
  console.log('=== Step 1: Building web app in real mode ===');
  execSync('pnpm --filter @syncpod/web build', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_REALTIME_MODE: 'real',
      DEMO_MODE: 'true',
      ALLOW_DEMO_IN_PROD: 'true',
      AUTH_SECRET,
      REALTIME_JWT_SECRET,
      DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5433/syncpod?schema=public',
      NO_COLOR: '1',
    },
    stdio: 'inherit',
  });

  console.log(`\n=== Step 2: Starting Next.js production server on port ${PORT} ===`);
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
        DATABASE_URL: 'postgresql://syncpod:syncpod@localhost:5433/syncpod?schema=public',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.on('data', (c) => (stderr += c.toString()));

  const cleanup = async () => {
    if (child.pid) {
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
    }
    await wait(500);
  };

  try {
    await waitForServer(`${BASE_URL}/masuk`);
    console.log('Server is ready.\n');

    // Check 1: /pod unauthed -> 307 to /masuk
    console.log('--- Check 1: GET /pod without cookie ---');
    const resPod = await fetch(`${BASE_URL}/pod`, { redirect: 'manual' });
    console.log(`Status: ${resPod.status}`);
    console.log(`Location: ${resPod.headers.get('location')}`);
    if (resPod.status !== 307 || !resPod.headers.get('location')?.includes('/masuk')) {
      throw new Error(`Expected 307 redirect to /masuk, got ${resPod.status}`);
    }

    // Check 2: /pod/nested-route unauthed -> 307 to /masuk
    console.log('\n--- Check 2: GET /pod/test-sprint-42 without cookie ---');
    const resPodNested = await fetch(`${BASE_URL}/pod/test-sprint-42`, { redirect: 'manual' });
    console.log(`Status: ${resPodNested.status}`);
    console.log(`Location: ${resPodNested.headers.get('location')}`);
    if (resPodNested.status !== 307 || !resPodNested.headers.get('location')?.includes('/masuk')) {
      throw new Error(`Expected 307 redirect to /masuk for nested pod route, got ${resPodNested.status}`);
    }

    // Check 3: /api/realtime/token unauthed -> 401
    console.log('\n--- Check 3: GET /api/realtime/token without cookie ---');
    const resToken = await fetch(`${BASE_URL}/api/realtime/token`, { redirect: 'manual' });
    console.log(`Status: ${resToken.status}`);
    console.log(`Cache-Control: ${resToken.headers.get('cache-control')}`);
    const tokenBody = await resToken.json();
    console.log(`Body: ${JSON.stringify(tokenBody)}`);
    if (resToken.status !== 401 || tokenBody.error?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED on /api/realtime/token, got ${resToken.status}`);
    }

    // Check 4: Login as demo user
    console.log('\n--- Check 4: POST /api/demo/login (demo-1@demo.syncpod.local) ---');
    const resLogin = await fetch(`${BASE_URL}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    console.log(`Login Status: ${resLogin.status}`);
    const setCookies = resLogin.headers.getSetCookie
      ? resLogin.headers.getSetCookie()
      : [resLogin.headers.get('set-cookie')].filter(Boolean);
    const sessionCookiePart = setCookies.find((c) => c && c.includes('session-token'));
    if (!sessionCookiePart) {
      throw new Error('No session-token cookie returned from /api/demo/login');
    }
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    console.log(`Received ${setCookies.length} cookies, including session-token`);

    // Check 5: /pod with session cookie -> 200
    console.log('\n--- Check 5: GET /pod with authenticated session cookie ---');
    const resPodAuthed = await fetch(`${BASE_URL}/pod`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    console.log(`Status: ${resPodAuthed.status}`);
    if (resPodAuthed.status !== 200) {
      throw new Error(`Expected 200 on /pod with session cookie, got ${resPodAuthed.status}`);
    }
    const podHtml = await resPodAuthed.text();
    if (!podHtml.includes('Rizqi Pratama') || !podHtml.includes('Realtime belum tersedia')) {
      throw new Error('Expected authenticated user name and status message on real /pod shell');
    }
    console.log('✓ Found user name "Rizqi Pratama" and notice "Realtime belum tersedia" in response HTML');

    // Check 6: /masuk with session cookie -> 307 to /pod
    console.log('\n--- Check 6: GET /masuk with authenticated session cookie ---');
    const resMasukAuthed = await fetch(`${BASE_URL}/masuk`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    console.log(`Status: ${resMasukAuthed.status}`);
    console.log(`Location: ${resMasukAuthed.headers.get('location')}`);
    if (resMasukAuthed.status !== 307 || !resMasukAuthed.headers.get('location')?.includes('/pod')) {
      throw new Error(`Expected 307 redirect to /pod when visiting /masuk while authenticated, got ${resMasukAuthed.status}`);
    }

    console.log('\nALL 6 REDIRECT & REAL-MODE AUTH MATRIX CHECKS PASSED PERFECTLY!');
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
