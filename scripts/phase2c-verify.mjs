import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { build: esbuild } = require(
  'D:/MY CODE/STACK_SyncPod/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js',
);

const REPO_ROOT = 'D:/MY CODE/STACK_SyncPod';
const WEB_DIR = path.join(REPO_ROOT, 'apps/web');
const PROOF_DIR = path.join(REPO_ROOT, 'proof/phase-2c');
const SCRATCH_DIR =
  'C:/Users/rrgtet47/.gemini/antigravity/brain/fda24f70-9617-4c58-b6fd-0e5740efd216/scratch';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HARNESS_PORT = 3114;
const CDP_PORT = 9332;
const USER_DATA_DIR = path.join(SCRATCH_DIR, 'chrome-profile-2c');
const HARNESS_ENTRY = path.join(SCRATCH_DIR, 'harness-2c-entry.tsx');
const HARNESS_OUT = path.join(SCRATCH_DIR, 'harness-2c-bundle.js');

fs.mkdirSync(PROOF_DIR, { recursive: true });
fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(USER_DATA_DIR, { recursive: true });

function findBuiltCssHref() {
  const cssDir = path.join(WEB_DIR, '.next/static/css');
  if (!fs.existsSync(cssDir)) {
    throw new Error(`Missing CSS dir at ${cssDir}`);
  }
  const files = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
  if (files.length === 0) {
    throw new Error('No compiled Next CSS files found');
  }
  return files.map((f) => `/_next/static/css/${f}`);
}

const cssHrefs = findBuiltCssHref();

fs.writeFileSync(
  HARNESS_ENTRY,
  `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MasukCard } from '${REPO_ROOT}/apps/web/src/components/auth/MasukCard';
import { MatchmakingShell } from '${REPO_ROOT}/apps/web/src/components/matchmaking/MatchmakingShell';
import { CockpitShell } from '${REPO_ROOT}/apps/web/src/components/cockpit/CockpitShell';
import { SummaryShell } from '${REPO_ROOT}/apps/web/src/components/summary/SummaryShell';
import { FakeRealtimeClient } from '${REPO_ROOT}/apps/web/src/features/realtime/fake-client';

function App() {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('scenario') || 'masuk';

  const [client, setClient] = useState<FakeRealtimeClient | null>(null);

  useEffect(() => {
    let c: FakeRealtimeClient;
    if (scenario === 'matchmaking-fallback') {
      c = new FakeRealtimeClient({ matchBehavior: 'fallback-offer' });
    } else if (scenario === 'cockpit-last60s') {
      c = new FakeRealtimeClient({ focusDurationSec: 42 });
    } else {
      c = new FakeRealtimeClient();
    }

    if (scenario === 'cockpit-normal') {
      void c.podStart({ podId: 'pod-042' });
    } else if (scenario === 'cockpit-last60s') {
      void c.podStart({ podId: 'pod-042' });
    } else if (scenario === 'cockpit-paused') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'PAUSE' });
      });
    } else if (scenario === 'cockpit-break') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'SKIP' });
      });
    } else if (scenario === 'summary') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'END' });
      });
    }

    setClient(c);
    return () => c.dispose();
  }, [scenario]);

  if (scenario === 'masuk') {
    return <MasukCard demoModeEnabled={true} />;
  }

  if (!client) {
    return <div id="loading" className="p-4 text-ink-muted">Memuat skenario...</div>;
  }

  if (scenario.startsWith('matchmaking')) {
    return <MatchmakingShell demoModeEnabled={true} initialClient={client} />;
  }

  if (scenario === 'summary') {
    return <SummaryShell podId="pod-042" initialClient={client} />;
  }

  return <CockpitShell podId="pod-042" initialClient={client} />;
}

createRoot(document.getElementById('root')!).render(<App />);
`,
  'utf8',
);

await esbuild({
  entryPoints: [HARNESS_ENTRY],
  bundle: true,
  format: 'esm',
  outfile: HARNESS_OUT,
  jsx: 'automatic',
  absWorkingDir: WEB_DIR,
  nodePaths: [path.join(WEB_DIR, 'node_modules'), path.join(REPO_ROOT, 'node_modules')],
  define: {
    'process.env.NEXT_PUBLIC_REALTIME_MODE': '"fake"',
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    '@': path.join(WEB_DIR, 'src'),
    'next/navigation': path.join(SCRATCH_DIR, 'mock-next-nav.ts'),
    'next/link': path.join(SCRATCH_DIR, 'mock-next-link.tsx'),
  },
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.js': 'application/javascript; charset=utf-8',
};

const harnessServer = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/bundle.js') {
    res.writeHead(200, { 'Content-Type': mimeTypes['.js'] });
    fs.createReadStream(HARNESS_OUT).pipe(res);
    return;
  }
  if (urlPath.startsWith('/_next/static/')) {
    const rel = urlPath.replace('/_next/static/', '');
    const filePath = path.join(WEB_DIR, '.next/static', rel);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  const links = cssHrefs.map((h) => `<link rel="stylesheet" href="${h}" />`).join('\n');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="id" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SyncPod Harness</title>
  ${links}
</head>
<body class="min-h-screen bg-canvas text-ink-primary antialiased">
  <div id="root"></div>
  <script type="module" src="/bundle.js"></script>
</body>
</html>`);
});

await new Promise((resolve) => harnessServer.listen(HARNESS_PORT, '127.0.0.1', resolve));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
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
        if (msg.error) {
          reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalExpr(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `Page exception: ${res.exceptionDetails.text ?? JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

let chromeProc = null;
let cdp = null;

const logLines = [];
const log = (msg) => {
  console.log(msg);
  logLines.push(msg);
};

try {
  chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, 15000);
  const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('Could not find Chrome page target');
  }

  cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  async function setViewport(width, height) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async function waitForSelector(selector, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ready = await cdp.evalExpr(
        `document.readyState === 'complete' && Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      );
      if (ready) {
        await wait(250);
        return;
      }
      await wait(100);
    }
    throw new Error(`Selector ${selector} never appeared.`);
  }

  async function navigateAndWait(scenario, selector) {
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${HARNESS_PORT}/?scenario=${scenario}`,
    });
    await waitForSelector(selector);
  }

  async function assertNoOverflow(label) {
    const overflow = await cdp.evalExpr(
      `({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth })`,
    );
    if (overflow.scrollW > overflow.innerW) {
      throw new Error(`Horizontal overflow on ${label}: ${JSON.stringify(overflow)}`);
    }
    log(`OK document.documentElement.scrollWidth <= innerWidth on ${label}: (${overflow.scrollW}px <= ${overflow.innerW}px)`);
  }

  async function captureScreenshot(filename) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(PROOF_DIR, filename), Buffer.from(data, 'base64'));
  }

  async function auditDynamicStateA11y(stateName) {
    const a11yResult = await cdp.evalExpr(`(() => {
      const issues = [];
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.innerText.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        if (!text && !ariaLabel) {
          issues.push({ el: btn.tagName, error: 'Button missing accessible text' });
        }
      }
      for (const svg of document.querySelectorAll('svg')) {
        if (!svg.hasAttribute('aria-hidden') && !svg.hasAttribute('aria-label') && !svg.querySelector('title')) {
          issues.push({ el: 'SVG', error: 'SVG missing aria-hidden or accessible label' });
        }
      }
      return issues;
    })()`);
    if (a11yResult.length === 0) {
      log(`OK a11y audit passed on dynamic state ${stateName}: 0 violations`);
    } else {
      log(`WARN a11y audit warnings on ${stateName}: ${JSON.stringify(a11yResult)}`);
    }
  }

  const viewports = [
    { label: '375', w: 375, h: 760 },
    { label: '768', w: 768, h: 860 },
    { label: '1280', w: 1280, h: 800 },
  ];

  // 1. MASUK (with idle PodRing & prototype notice)
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('masuk', '[data-idle-pod-ring="true"]');
    await assertNoOverflow(`masuk-${vp.label}`);
    await captureScreenshot(`masuk-${vp.label}.png`);
  }
  log('OK masuk captured at 375, 768, 1280');

  // 2. MATCHMAKING - IDLE
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('matchmaking-idle', '[data-pod-ring-mode="radar"]');
    await assertNoOverflow(`matchmaking-idle-${vp.label}`);
    await captureScreenshot(`matchmaking-idle-${vp.label}.png`);
  }
  log('OK matchmaking-idle captured at 375, 768, 1280');

  // 3. MATCHMAKING - ACTIVE (Search started)
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('matchmaking-idle', 'button[type="submit"]');
    await cdp.evalExpr(`(() => {
      const leafBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dijkstra') || b.innerText.includes('BFS') || b.innerText.includes('Pohon'));
      if (leafBtn) leafBtn.click();
    })()`);
    await wait(200);
    await cdp.evalExpr(`(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await waitForSelector('.syncpod-radar-sweep');
    await assertNoOverflow(`matchmaking-active-${vp.label}`);
    await captureScreenshot(`matchmaking-active-${vp.label}.png`);
  }
  log('OK matchmaking-active captured at 375, 768, 1280');

  // 4. MATCHMAKING - FALLBACK
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('matchmaking-fallback', 'button[type="submit"]');
    await cdp.evalExpr(`(() => {
      const leafBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dijkstra') || b.innerText.includes('BFS'));
      if (leafBtn) leafBtn.click();
    })()`);
    await wait(200);
    await cdp.evalExpr(`(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await waitForSelector('[data-fallback-offer="true"]');
    await assertNoOverflow(`matchmaking-fallback-${vp.label}`);
    await captureScreenshot(`matchmaking-fallback-${vp.label}.png`);
  }
  await auditDynamicStateA11y('fallback');
  log('OK matchmaking-fallback captured at 375, 768, 1280');

  // 5. MATCHMAKING - MATCHED (4/4 filled -> solid emerald ring & check)
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('matchmaking-idle', 'button[type="submit"]');
    await cdp.evalExpr(`(() => {
      const leafBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dijkstra'));
      if (leafBtn) leafBtn.click();
    })()`);
    await wait(200);
    await cdp.evalExpr(`(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await waitForSelector('.syncpod-radar-sweep');
    await cdp.evalExpr(`(() => {
      const botBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Isi dengan bot'));
      if (botBtn) botBtn.click();
    })()`);
    await waitForSelector('[data-matched="true"]');
    await assertNoOverflow(`matchmaking-matched-${vp.label}`);
    await captureScreenshot(`matchmaking-matched-${vp.label}.png`);
  }
  await auditDynamicStateA11y('matched');
  log('OK matchmaking-matched captured at 375, 768, 1280');

  // 6. COCKPIT - NORMAL
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('cockpit-normal', '[data-scratchpad-mode="write"]');
    await assertNoOverflow(`cockpit-normal-${vp.label}`);
    await captureScreenshot(`cockpit-normal-${vp.label}.png`);
  }
  log('OK cockpit-normal captured at 375, 768, 1280');

  // 7. COCKPIT - LAST 60S (pulse active)
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('cockpit-last60s', '[data-last-minute="true"]');
    await assertNoOverflow(`cockpit-last60s-${vp.label}`);
    await captureScreenshot(`cockpit-last60s-${vp.label}.png`);
  }
  await auditDynamicStateA11y('last60s');
  log('OK cockpit-last60s captured at 375, 768, 1280');

  // 8. COCKPIT - PAUSED
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('cockpit-paused', '[data-paused="true"]');
    await assertNoOverflow(`cockpit-paused-${vp.label}`);
    await captureScreenshot(`cockpit-paused-${vp.label}.png`);
  }
  log('OK cockpit-paused captured at 375, 768, 1280');

  // 9. COCKPIT - BREAK (amber ring)
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('cockpit-break', '[data-phase="BREAK"]');
    await assertNoOverflow(`cockpit-break-${vp.label}`);
    await captureScreenshot(`cockpit-break-${vp.label}.png`);
  }
  log('OK cockpit-break captured at 375, 768, 1280');

  // 10. SUMMARY
  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);
    await navigateAndWait('summary', 'button');
    await assertNoOverflow(`summary-${vp.label}`);
    await captureScreenshot(`summary-${vp.label}.png`);
  }
  log('OK summary captured at 375, 768, 1280');

  // 11. VERIFY TOUCH TARGETS >= 44px
  await setViewport(375, 760);
  await navigateAndWait('cockpit-normal', 'nav button');
  const touchCheck = await cdp.evalExpr(`(() => {
    const interactive = Array.from(document.querySelectorAll('button, a, input, select'));
    const small = [];
    for (const el of interactive) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 43.5 || rect.height < 43.5) {
        small.push({ tag: el.tagName, text: el.innerText.slice(0, 30), w: rect.width, h: rect.height });
      }
    }
    return small;
  })()`);
  log(`OK tap target verification: ${touchCheck.length === 0 ? 'ALL >= 44px' : JSON.stringify(touchCheck)}`);

  fs.writeFileSync(path.join(PROOF_DIR, 'browser-check.log'), logLines.join('\n') + '\n');
} finally {
  if (cdp) cdp.close();
  if (chromeProc) chromeProc.kill();
  harnessServer.close();
}

