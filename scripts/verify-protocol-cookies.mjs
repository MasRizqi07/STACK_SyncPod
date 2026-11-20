import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskSensitiveData } from './proof-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envContent = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
  const envVars = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[trimmed.slice(0, idx).trim()] = val;
    }
  }
  return envVars;
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // waiting
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function main() {
  const baseEnv = loadEnv();
  const PORT = 3198;
  const LAN_IP = '10.26.56.86';

  const serverEnv = {
    ...process.env,
    ...baseEnv,
    NODE_ENV: 'production',
    ALLOW_DEMO_IN_PROD: 'true',
    DEMO_MODE: 'true',
    PORT: String(PORT),
    AUTH_SECRET: 'syncpod-dev-secret-auth-32bytes-syncpod!!',
  };

  console.log(`Starting Next.js production server on 0.0.0.0:${PORT}...`);
  const nextProc = spawn('pnpm', ['--filter', '@syncpod/web', 'exec', 'next', 'start', '-H', '0.0.0.0', '-p', String(PORT)], {
    cwd: REPO_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  try {
    await waitForServer(`http://localhost:${PORT}/api/demo/login`);
    console.log(`Server ready on 0.0.0.0:${PORT}\n`);

    // CASE 1: http://localhost
    console.log('CASE 1: http://localhost');
    const res1 = await fetch(`http://localhost:${PORT}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [res1.headers.get('set-cookie')];
    const sessionCookie1 = cookies1.find((c) => c && c.includes('session-token')) || '';
    const masked1 = maskSensitiveData(`Set-Cookie: ${sessionCookie1}`);
    console.log(`  ${masked1}`);

    const lower1 = sessionCookie1.toLowerCase();
    if (!lower1.includes('httponly') || !lower1.includes('samesite=lax')) {
      throw new Error('Case 1 missing HttpOnly or SameSite=Lax');
    }
    if (lower1.includes('secure') || sessionCookie1.includes('__Secure-')) {
      throw new Error('Case 1 unexpectedly has Secure or __Secure- on http://localhost');
    }
    console.log('  Result: PASS (HttpOnly=true, SameSite=Lax, Secure=false, __Secure-=false)\n');

    // CASE 2: http://<IP LAN> with next start -H 0.0.0.0 (NODE_ENV=production)
    console.log(`CASE 2: http://${LAN_IP}:${PORT} (LAN access in NODE_ENV=production)`);
    const res2 = await fetch(`http://${LAN_IP}:${PORT}/api/demo/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `${LAN_IP}:${PORT}`,
      },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    const cookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [res2.headers.get('set-cookie')];
    const sessionCookie2 = cookies2.find((c) => c && c.includes('session-token')) || '';
    const masked2 = maskSensitiveData(`Set-Cookie: ${sessionCookie2}`);
    console.log(`  ${masked2}`);

    const lower2 = sessionCookie2.toLowerCase();
    if (!lower2.includes('httponly') || !lower2.includes('samesite=lax')) {
      throw new Error('Case 2 missing HttpOnly or SameSite=Lax');
    }
    if (lower2.includes('secure') || sessionCookie2.includes('__Secure-')) {
      throw new Error('Case 2 unexpectedly has Secure or __Secure- on HTTP LAN');
    }
    console.log('  Result: PASS (HttpOnly=true, SameSite=Lax, Secure=false, __Secure-=false)\n');

    // CASE 3: request with x-forwarded-proto: https and AUTH_URL with https scheme
    console.log('CASE 3: x-forwarded-proto: https (HTTPS reverse proxy / production deployment)');
    const res3 = await fetch(`http://localhost:${PORT}/api/demo/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'syncpod.example.com',
      },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    const cookies3 = res3.headers.getSetCookie ? res3.headers.getSetCookie() : [res3.headers.get('set-cookie')];
    const sessionCookie3 = cookies3.find((c) => c && c.includes('session-token')) || '';
    const masked3 = maskSensitiveData(`Set-Cookie: ${sessionCookie3}`);
    console.log(`  ${masked3}`);

    const lower3 = sessionCookie3.toLowerCase();
    if (!lower3.includes('httponly') || !lower3.includes('samesite=lax')) {
      throw new Error('Case 3 missing HttpOnly or SameSite=Lax');
    }
    if (!lower3.includes('secure') || !sessionCookie3.includes('__Secure-')) {
      throw new Error('Case 3 missing Secure or __Secure- on HTTPS');
    }
    console.log('  Result: PASS (HttpOnly=true, SameSite=Lax, Secure=true, __Secure-=true)\n');

    console.log('PROTOCOL-AWARE COOKIE VERIFICATION: ALL 3 CASES PASSED');
  } finally {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(nextProc.pid), '/f', '/t']);
    } else {
      nextProc.kill('SIGINT');
    }
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
