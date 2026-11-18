import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRealtimeToken } from '../packages/shared/dist/realtime-token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PROOF_DIR = path.join(REPO_ROOT, 'proof', 'phase-3');
const SCRATCH_DIR = path.join(REPO_ROOT, '.scratch');
const CHROME_PATH =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

fs.mkdirSync(PROOF_DIR, { recursive: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

function loadRootEnv() {
  const envFile = path.join(REPO_ROOT, '.env');
  const loaded = {};
  if (!fs.existsSync(envFile)) return loaded;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    loaded[key] = val;
  }
  return loaded;
}

const DOT_ENV = loadRootEnv();
const DATABASE_URL =
  process.env.DATABASE_URL ||
  DOT_ENV.DATABASE_URL ||
  'postgresql://syncpod:syncpod@localhost:5433/syncpod?schema=public';

const SENTINEL_AUTH_SECRET = 'SENTINEL_AUTH_SECRET_PHASE3B_NEVER_IN_BUNDLE_987654321';
const SENTINEL_REALTIME_SECRET = 'SENTINEL_REALTIME_JWT_SECRET_PHASE3B_NEVER_LEAK_123456';
const SENTINEL_GEMINI_KEY = 'SENTINEL_GEMINI_API_KEY_PHASE3B_SERVER_ONLY_555555';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCmd(cmd, envOverrides = {}, cwd = REPO_ROOT) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_URL,
      ...envOverrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

async function waitForServer(url, timeoutMs = 20000) {
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

function startWebServer(port, envOverrides = {}) {
  const child = spawn(
    'pnpm',
    ['--filter', '@syncpod/web', 'exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'],
    {
      cwd: REPO_ROOT,
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NO_COLOR: '1',
        NEXT_TELEMETRY_DISABLED: '1',
        DATABASE_URL,
        ...envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  return {
    child,
    getStderr: () => stderr,
    stop: async () => {
      if (child.pid) {
        try {
          execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          try {
            child.kill('SIGTERM');
          } catch {
            // ignore
          }
        }
      }
      await wait(400);
    },
  };
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', (err) => reject(err), { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) {
          fn(msg.params);
        }
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('Step 1: Ensure @syncpod/shared & @syncpod/db built and DB seeded...');
  runCmd('pnpm --filter @syncpod/shared build');
  runCmd('pnpm --filter @syncpod/db build');
  runCmd('pnpm db:migrate');
  runCmd('pnpm db:seed');

  // --- STEP 2: Targeted logs (token.log, authz.log, env-validation.log) ---
  console.log('Step 2: Generating token.log, authz.log, env-validation.log...');
  const tokenOut = runCmd('pnpm --filter @syncpod/shared exec vitest run test/realtime-token.test.ts');
  fs.writeFileSync(path.join(PROOF_DIR, 'token.log'), tokenOut, 'utf8');

  const authzOut = runCmd('pnpm --filter @syncpod/db exec vitest run test/authz.test.ts');
  fs.writeFileSync(path.join(PROOF_DIR, 'authz.log'), authzOut, 'utf8');

  const webEnvOut = runCmd('pnpm --filter @syncpod/web exec vitest run test/env.test.ts');
  const rtEnvOut = runCmd('pnpm --filter @syncpod/realtime exec vitest run test/env.test.ts');
  fs.writeFileSync(
    path.join(PROOF_DIR, 'env-validation.log'),
    `=== apps/web env validation ===\n${webEnvOut}\n=== apps/realtime env validation ===\n${rtEnvOut}`,
    'utf8',
  );

  // --- STEP 3: Fake-mode build & bundle isolation proof ---
  console.log('Step 3: Building fake mode and checking client bundle isolation...');
  runCmd('pnpm --filter @syncpod/web build', {
    NEXT_PUBLIC_REALTIME_MODE: 'fake',
    AUTH_SECRET: SENTINEL_AUTH_SECRET,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME_SECRET,
    GEMINI_API_KEY: SENTINEL_GEMINI_KEY,
  });

  const staticDir = path.join(REPO_ROOT, 'apps', 'web', '.next', 'static');
  const fakeStaticFiles = walkFiles(staticDir);
  const forbiddenFakeTokens = ['next-auth', '@prisma/client', 'PrismaClient', 'SignJWT', 'jwtVerify'];
  const fakeHits = [];
  for (const file of fakeStaticFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const token of forbiddenFakeTokens) {
      if (content.includes(token)) {
        fakeHits.push({ file: path.relative(REPO_ROOT, file), token });
      }
    }
  }
  if (fakeHits.length > 0) {
    throw new Error(`Fake client bundle leaked forbidden imports: ${JSON.stringify(fakeHits)}`);
  }

  const fakeServer = startWebServer(3121, {
    NEXT_PUBLIC_REALTIME_MODE: 'fake',
    DEMO_MODE: 'false',
  });
  let fakePodStatus = 0;
  try {
    await waitForServer('http://127.0.0.1:3121/masuk');
    const res = await fetch('http://127.0.0.1:3121/pod', { redirect: 'manual' });
    fakePodStatus = res.status;
    if (fakePodStatus !== 200) {
      throw new Error(`Expected HTTP 200 on /pod in fake mode, got ${fakePodStatus}`);
    }
  } finally {
    await fakeServer.stop();
  }

  // --- STEP 4: Real-mode build & secret hygiene proof ---
  console.log('Step 4: Building real mode and verifying secret hygiene + DemoControls exclusion...');
  runCmd('pnpm --filter @syncpod/web build', {
    NEXT_PUBLIC_REALTIME_MODE: 'real',
    AUTH_SECRET: SENTINEL_AUTH_SECRET,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME_SECRET,
    GEMINI_API_KEY: SENTINEL_GEMINI_KEY,
  });

  const realStaticFiles = walkFiles(staticDir);
  const demoControlHits = [];
  for (const file of realStaticFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('DemoControls') || content.includes('Kontrol demo (simulasi)')) {
      demoControlHits.push(path.relative(REPO_ROOT, file));
    }
  }
  if (demoControlHits.length > 0) {
    throw new Error(`DemoControls leaked into real build: ${demoControlHits.join(', ')}`);
  }

  const fakeBundleLines = [
    '=== FAKE & REAL BUNDLE ISOLATION AUDIT (Tasks 3.6 & D18, D25) ===',
    `FAKE BUILD: Scanned ${fakeStaticFiles.length} client assets in apps/web/.next/static`,
    `  Forbidden tokens checked: ${forbiddenFakeTokens.join(', ')}`,
    '  Matches found: 0 (PASS)',
    `  HTTP GET /pod without session in fake mode: HTTP ${fakePodStatus} (PASS)`,
    '',
    `REAL BUILD: Scanned ${realStaticFiles.length} client assets in apps/web/.next/static`,
    '  Checked DemoControls / "Kontrol demo (simulasi)" (D25): 0 matches (PASS)',
    '',
    'BUNDLE ISOLATION RESULT: PASS',
  ];
  fs.writeFileSync(path.join(PROOF_DIR, 'fake-bundle.log'), fakeBundleLines.join('\n') + '\n', 'utf8');

  const secretHygieneOut = runCmd('node scripts/check-secret-hygiene.mjs', {
    AUTH_SECRET: SENTINEL_AUTH_SECRET,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME_SECRET,
    GEMINI_API_KEY: SENTINEL_GEMINI_KEY,
  });
  const checkIgnore = runCmd('git check-ignore -v .env');
  fs.writeFileSync(
    path.join(PROOF_DIR, 'bundle-secrets.log'),
    `${secretHygieneOut}\ngit check-ignore -v .env:\n${checkIgnore}`,
    'utf8',
  );

  // --- STEP 5: Live real-mode redirect check & DEMO_MODE=false check ---
  console.log('Step 5: Verifying real-mode 307 redirects and DEMO_MODE=false 403...');
  const redirectLines = ['=== REAL-MODE ROUTE PROTECTION AUDIT (Task 3.6, Next 16 proxy.ts) ==='];
  let demoDisabledStatus = 0;
  let demoDisabledBody = '';
  const serverDemoOff = startWebServer(3122, {
    NEXT_PUBLIC_REALTIME_MODE: 'real',
    DEMO_MODE: 'false',
    ALLOW_DEMO_IN_PROD: 'false',
    AUTH_SECRET: SENTINEL_AUTH_SECRET,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME_SECRET,
  });
  try {
    await waitForServer('http://127.0.0.1:3122/masuk');

    for (const route of ['/pod', '/pod/x', '/pod/x/selesai']) {
      const res = await fetch(`http://127.0.0.1:3122${route}`, {
        method: 'HEAD',
        redirect: 'manual',
      });
      const loc = res.headers.get('location');
      redirectLines.push(`HEAD ${route} -> HTTP ${res.status} | Location: ${loc}`);
      if (res.status !== 307 || !loc?.endsWith('/masuk')) {
        throw new Error(`Expected 307 -> /masuk for ${route}, got ${res.status} -> ${loc}`);
      }
    }

    const demoOffRes = await fetch('http://127.0.0.1:3122/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    demoDisabledStatus = demoOffRes.status;
    demoDisabledBody = await demoOffRes.text();
    if (demoDisabledStatus !== 403) {
      throw new Error(`Expected 403 when DEMO_MODE=false, got ${demoDisabledStatus}`);
    }
  } finally {
    await serverDemoOff.stop();
  }
  redirectLines.push('', 'REDIRECT AUDIT RESULT: PASS (All protected routes return HTTP 307 -> /masuk)');
  fs.writeFileSync(path.join(PROOF_DIR, 'redirect-real.log'), redirectLines.join('\n') + '\n', 'utf8');

  // --- STEP 6: Live real-mode auth matrix + realtime token + offline Chrome CDP check ---
  console.log('Step 6: Verifying full auth matrix, realtime token, and offline Chrome CDP flow...');
  const serverDemoOn = startWebServer(3123, {
    NEXT_PUBLIC_REALTIME_MODE: 'real',
    DEMO_MODE: 'true',
    ALLOW_DEMO_IN_PROD: 'true',
    AUTH_SECRET: SENTINEL_AUTH_SECRET,
    REALTIME_JWT_SECRET: SENTINEL_REALTIME_SECRET,
  });

  const authLines = ['=== PHASE 3 COMPLETE AUTH & REALTIME TOKEN MATRIX ==='];
  const offlineLines = ['=== PHASE 3 OFFLINE VERIFICATION (Local Postgres + External Network Blocked) ==='];

  try {
    await waitForServer('http://127.0.0.1:3123/masuk');

    // 1. GET /api/realtime/token without cookie -> 401
    const unauthTokenRes = await fetch('http://127.0.0.1:3123/api/realtime/token');
    const unauthTokenBody = await unauthTokenRes.text();
    if (unauthTokenRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/realtime/token, got ${unauthTokenRes.status}`);
    }
    authLines.push(
      'CHECK 1 (GET /api/realtime/token without session cookie):',
      `  Response: HTTP ${unauthTokenRes.status} -> ${unauthTokenBody}`,
      '  Result:   PASS',
      '',
    );

    // 2. POST /api/demo/login with DEMO_MODE=false -> 403
    authLines.push(
      'CHECK 2 (POST /api/demo/login when DEMO_MODE=false):',
      `  Response: HTTP ${demoDisabledStatus} -> ${demoDisabledBody}`,
      '  Result:   PASS',
      '',
    );

    // 3. Bot rejection -> 403
    const botRes = await fetch('http://127.0.0.1:3123/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'simulasi-1@bot.syncpod.local' }),
    });
    const botBody = await botRes.text();
    if (botRes.status !== 403) throw new Error(`Expected 403 for bot, got ${botRes.status}`);
    authLines.push(
      'CHECK 3 (POST /api/demo/login with bot email):',
      `  Response: HTTP ${botRes.status} -> ${botBody}`,
      '  Result:   PASS',
      '',
    );

    // 4. Arbitrary email rejection -> 403
    const arbRes = await fetch('http://127.0.0.1:3123/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'random@gmail.com' }),
    });
    const arbBody = await arbRes.text();
    if (arbRes.status !== 403) throw new Error(`Expected 403 for arbitrary email, got ${arbRes.status}`);
    authLines.push(
      'CHECK 4 (POST /api/demo/login with arbitrary email):',
      `  Response: HTTP ${arbRes.status} -> ${arbBody}`,
      '  Result:   PASS',
      '',
    );

    // 5. Valid seeded demo login -> 200 + cookie
    const loginRes = await fetch('http://127.0.0.1:3123/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo-1@demo.syncpod.local' }),
    });
    const loginBody = await loginRes.text();
    const setCookie = loginRes.headers.get('set-cookie') || '';
    if (loginRes.status !== 200 || !setCookie.includes('authjs.session-token=')) {
      throw new Error(`Demo login failed: status=${loginRes.status}, cookie=${setCookie}`);
    }
    const cookiePair = setCookie.split(';')[0];
    authLines.push(
      'CHECK 5 (POST /api/demo/login with valid seeded demo account):',
      `  Response: HTTP ${loginRes.status} -> ${loginBody}`,
      `  Cookie:   [REDACTED_VALUE]; ${setCookie.split(';').slice(1).join(';').trim()}`,
      '  Result:   PASS',
      '',
    );

    // 6. GET /api/auth/session with cookie -> 200
    const sessionRes = await fetch('http://127.0.0.1:3123/api/auth/session', {
      headers: { Cookie: cookiePair },
    });
    const sessionBody = await sessionRes.text();
    if (sessionRes.status !== 200 || !sessionBody.includes('demo-1@demo.syncpod.local')) {
      throw new Error(`Session check failed: ${sessionRes.status} ${sessionBody}`);
    }
    authLines.push(
      'CHECK 6 (GET /api/auth/session with session cookie):',
      `  Response: HTTP ${sessionRes.status} -> ${sessionBody}`,
      '  Result:   PASS',
      '',
    );

    // 7. GET /api/realtime/token with cookie -> 200 + verified JWT exp - iat = 300
    const tokenRes = await fetch('http://127.0.0.1:3123/api/realtime/token', {
      headers: { Cookie: cookiePair },
    });
    const tokenJson = await tokenRes.json();
    if (tokenRes.status !== 200 || typeof tokenJson.token !== 'string') {
      throw new Error(`Realtime token failed: ${tokenRes.status}`);
    }
    const verified = await verifyRealtimeToken(tokenJson.token, SENTINEL_REALTIME_SECRET);
    if (verified.exp - verified.iat !== 300) {
      throw new Error(`Expected exp - iat = 300, got ${verified.exp - verified.iat}`);
    }
    authLines.push(
      'CHECK 7 (GET /api/realtime/token with session cookie):',
      `  Response: HTTP ${tokenRes.status} -> token=[REDACTED_JWT], expiresAt=${tokenJson.expiresAt}`,
      `  Verified: sub=${verified.userId}, exp - iat = ${verified.exp - verified.iat}s (HS256)`,
      '  Result:   PASS',
      '',
    );

    // 8. Authenticated GET /pod -> 200 (proxy allows through)
    const authedPodRes = await fetch('http://127.0.0.1:3123/pod', {
      headers: { Cookie: cookiePair },
      redirect: 'manual',
    });
    if (authedPodRes.status !== 200) {
      throw new Error(`Expected authenticated GET /pod = 200, got ${authedPodRes.status}`);
    }
    authLines.push(
      'CHECK 8 (Authenticated GET /pod through proxy.ts):',
      `  Response: HTTP ${authedPodRes.status}`,
      '  Result:   PASS',
      '',
      'CHECK 9 (Google OAuth status):',
      '  Status:   UNVERIFIED (no credentials) [Per D17 cut-line]',
      '',
      'AUTH MATRIX VERIFICATION: ALL CHECKS PASSED',
    );

    // 9. Real headless Chrome CDP offline flow check (external network blocked via CDP Fetch)
    if (!fs.existsSync(CHROME_PATH)) {
      throw new Error(`Chrome not found at ${CHROME_PATH}`);
    }
    const profileDir = path.join(SCRATCH_DIR, 'chrome-profile-3b');
    fs.rmSync(profileDir, { recursive: true, force: true });
    fs.mkdirSync(profileDir, { recursive: true });

    const chrome = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=9333',
        `--user-data-dir=${profileDir}`,
        '--window-size=1280,800',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    let cdp = null;
    try {
      await waitForServer('http://127.0.0.1:9333/json/list', 15000);
      const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
      const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
      cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
      await cdp.connect();

      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

      const externalBlocked = [];
      const localAllowed = [];

      cdp.on('Fetch.requestPaused', async (params) => {
        const reqUrl = params.request.url;
        const isLocal =
          reqUrl.startsWith('http://127.0.0.1:') ||
          reqUrl.startsWith('http://localhost:') ||
          reqUrl.startsWith('data:') ||
          reqUrl.startsWith('blob:');
        if (isLocal) {
          localAllowed.push(reqUrl);
          await cdp.send('Fetch.continueRequest', { requestId: params.requestId }).catch(() => {});
        } else {
          externalBlocked.push(reqUrl);
          await cdp
            .send('Fetch.failRequest', {
              requestId: params.requestId,
              errorReason: 'InternetDisconnected',
            })
            .catch(() => {});
        }
      });

      await cdp.send('Page.navigate', { url: 'http://127.0.0.1:3123/masuk' });
      await wait(1800);

      const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(
        path.join(PROOF_DIR, 'auth-demo-1-masuk.png'),
        Buffer.from(shot1.data, 'base64'),
      );

      // Click "Masuk sebagai akun demo"
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('akun demo'));
          if (!btn) throw new Error('Demo login button not found');
          btn.click();
          return true;
        })()`,
        returnByValue: true,
      });

      // Wait for navigation to /pod
      let finalUrl = '';
      for (let i = 0; i < 30; i += 1) {
        await wait(250);
        const res = await cdp.send('Runtime.evaluate', {
          expression: 'window.location.href',
          returnByValue: true,
        });
        finalUrl = String(res.result?.value || '');
        if (finalUrl.includes('/pod')) break;
      }

      await wait(1000);
      const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(
        path.join(PROOF_DIR, 'auth-demo-2-authenticated.png'),
        Buffer.from(shot2.data, 'base64'),
      );

      if (!finalUrl.includes('/pod')) {
        throw new Error(`Expected browser to navigate to /pod, stayed at ${finalUrl}`);
      }
      if (externalBlocked.length > 0) {
        throw new Error(`External requests attempted while offline: ${externalBlocked.join(', ')}`);
      }

      offlineLines.push(
        'Blocking method: Chrome DevTools Protocol Fetch.enable blocking all non-localhost/127.0.0.1 URLs with InternetDisconnected',
        'Flow executed:   GET /masuk -> click "Masuk sebagai akun demo" -> POST /api/demo/login (local Postgres) -> redirect /pod',
        `Final URL:       ${finalUrl}`,
        `Local requests:  ${localAllowed.length} succeeded`,
        `External reqs:   ${externalBlocked.length} attempted (ZERO external network dependencies)`,
        'Screenshots:     proof/phase-3/auth-demo-1-masuk.png, proof/phase-3/auth-demo-2-authenticated.png',
        '',
        'OFFLINE VERIFICATION RESULT: PASS',
      );
    } finally {
      if (cdp) cdp.close();
      if (chrome.pid) {
        try {
          execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // ignore
        }
      }
    }
  } finally {
    await serverDemoOn.stop();
  }

  fs.writeFileSync(path.join(PROOF_DIR, 'auth-matrix.log'), authLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(PROOF_DIR, 'offline.log'), offlineLines.join('\n') + '\n', 'utf8');

  // --- STEP 7: Workspace-wide gates ---
  console.log('Step 7: Running workspace-wide typecheck, lint, test, build, and no-skip...');
  const typecheckOut = runCmd('pnpm -r typecheck');
  fs.writeFileSync(path.join(PROOF_DIR, 'typecheck.log'), typecheckOut, 'utf8');

  const lintOut = runCmd('pnpm -r lint');
  fs.writeFileSync(path.join(PROOF_DIR, 'lint.log'), lintOut, 'utf8');

  const testOut = runCmd('pnpm -r test');
  fs.writeFileSync(path.join(PROOF_DIR, 'test.log'), testOut, 'utf8');

  const buildOut = runCmd('pnpm -r build');
  fs.writeFileSync(path.join(PROOF_DIR, 'build.log'), buildOut, 'utf8');

  // no-skip check across apps/*/test and packages/*/test
  const testFiles = [
    ...walkFiles(path.join(REPO_ROOT, 'apps', 'web', 'test')),
    ...walkFiles(path.join(REPO_ROOT, 'apps', 'realtime', 'test')),
    ...walkFiles(path.join(REPO_ROOT, 'packages', 'db', 'test')),
    ...walkFiles(path.join(REPO_ROOT, 'packages', 'shared', 'test')),
  ];
  const skipPattern = /\.(skip|only)\(|xit\(|xdescribe\(/;
  const skipHits = [];
  for (const tf of testFiles) {
    const lines = fs.readFileSync(tf, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (skipPattern.test(line)) {
        skipHits.push(`${path.relative(REPO_ROOT, tf)}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
  if (skipHits.length > 0) {
    throw new Error(`Skipped/filtered tests found:\n${skipHits.join('\n')}`);
  }
  fs.writeFileSync(
    path.join(PROOF_DIR, 'no-skip.log'),
    `PASS: Scanned ${testFiles.length} test files across workspace; zero skipped or filtered tests found.\n`,
    'utf8',
  );

  console.log('\nALL PHASE 3B VERIFICATION CHECKS PASSED!');
}

main().catch((err) => {
  console.error('PHASE 3B VERIFY FAILED:', err);
  process.exit(1);
});
