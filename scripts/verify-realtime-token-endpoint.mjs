import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRealtimeToken } from '../packages/shared/dist/server/realtime-token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const PORT = 3134;
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
    } catch {}
    await wait(250);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function main() {
  console.log('=== Step 1: Starting server on port ' + PORT + ' ===');
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
    console.log('Server ready.\n');

    // 1. Without session -> 401
    console.log('--- 1. GET /api/realtime/token without session ---');
    const unauthedRes = await fetch(`${BASE_URL}/api/realtime/token`, { redirect: 'manual' });
    console.log(`Status: ${unauthedRes.status}`);
    console.log(`Cache-Control: ${unauthedRes.headers.get('cache-control')}`);
    const unauthedBody = await unauthedRes.json();
    console.log(`Body: ${JSON.stringify(unauthedBody)}`);
    if (unauthedRes.status !== 401 || unauthedBody.error?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED, got ${unauthedRes.status}`);
    }
    console.log('✓ Unauthenticated request rejected with 401 UNAUTHENTICATED\n');

    // 2. Login as demo user
    console.log('--- 2. POST /api/demo/login (demo-1@demo.syncpod.local) ---');
    const loginRes = await fetch(`${BASE_URL}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    console.log(`Login Status: ${loginRes.status}`);
    const setCookies = loginRes.headers.getSetCookie
      ? loginRes.headers.getSetCookie()
      : [loginRes.headers.get('set-cookie')].filter(Boolean);
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    console.log(`Session established, cookie acquired.\n`);

    // 3. With session -> 200, { token, expiresAt }
    console.log('--- 3. GET /api/realtime/token with authenticated session ---');
    const authedRes = await fetch(`${BASE_URL}/api/realtime/token`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    console.log(`Status: ${authedRes.status}`);
    console.log(`Cache-Control: ${authedRes.headers.get('cache-control')}`);
    const authedBody = await authedRes.json();
    if (authedRes.status !== 200 || !authedBody.token || !authedBody.expiresAt) {
      throw new Error(`Expected 200 with token and expiresAt, got status ${authedRes.status}`);
    }
    console.log(`ExpiresAt: ${authedBody.expiresAt}`);

    // 4. Decode header and payload ONLY (never print signature, D39 secret hygiene)
    const [headerB64, payloadB64] = authedBody.token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    console.log('\n--- 4. Decoded Token Claims (Header + Payload only, signature omitted) ---');
    console.log(`Header: ${JSON.stringify(header)}`);
    console.log(`Payload: ${JSON.stringify(payload)}`);

    const ttl = payload.exp - payload.iat;
    console.log(`Computed TTL: ${ttl}s (expected 300s)`);
    if (ttl !== 300) {
      throw new Error(`Expected TTL to be 300 seconds, got ${ttl}`);
    }
    if (header.alg !== 'HS256') {
      throw new Error(`Expected alg HS256, got ${header.alg}`);
    }
    if (payload.iss !== 'syncpod-web') {
      throw new Error(`Expected iss syncpod-web, got ${payload.iss}`);
    }
    if (payload.aud !== 'syncpod-realtime') {
      throw new Error(`Expected aud syncpod-realtime, got ${payload.aud}`);
    }
    if (!payload.sub) {
      throw new Error('Expected sub to be non-empty');
    }
    console.log('✓ Token header and payload claims strictly conform to D39\n');

    // 5. Verify using verifyRealtimeToken
    console.log('--- 5. Verifier Execution via verifyRealtimeToken ---');
    const verified = await verifyRealtimeToken(authedBody.token, REALTIME_JWT_SECRET);
    console.log(`Verified Result: ${JSON.stringify(verified)}`);
    if (verified.userId !== payload.sub || verified.exp !== payload.exp) {
      throw new Error('Verifier output does not match token payload');
    }
    console.log('✓ Token successfully verified by server verifier with correct userId and lifetime');

    console.log('\nALL REALTIME TOKEN CHECKS PASSED PERFECTLY!');
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
