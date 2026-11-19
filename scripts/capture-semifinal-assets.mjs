#!/usr/bin/env node
/**
 * scripts/capture-semifinal-assets.mjs
 * Captures all 14 required states for the semifinal pack at Desktop (1920x1080)
 * and Mobile (390x844 @2x).
 * Emulates prefers-reduced-motion: reduce for deterministic, consistent images.
 * Outputs to Docs/semifinal/assets/ with manifest.json.
 * Enforces total package size <= 6 MB.
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(REPO_ROOT, 'apps/web');
const ASSETS_DIR = path.join(REPO_ROOT, 'Docs/semifinal/assets');
const SCRATCH_DIR = path.join(REPO_ROOT, '.scratch');

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const require = createRequire(import.meta.url);
const esbuildPnpmDirect = path.join(REPO_ROOT, 'node_modules/.pnpm/node_modules/esbuild/lib/main.js');
const esbuildVersioned = path.join(REPO_ROOT, 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js');
const esbuildPath = fs.existsSync(esbuildPnpmDirect) ? esbuildPnpmDirect : esbuildVersioned;
const { build: esbuild } = require(esbuildPath);

const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HARNESS_PORT = 3124;
const CDP_PORT = 9334;
const USER_DATA_DIR = path.join(SCRATCH_DIR, 'chrome-profile-assets');
const HARNESS_ENTRY = path.join(SCRATCH_DIR, 'harness-assets-entry.tsx');
const HARNESS_OUT = path.join(SCRATCH_DIR, 'harness-assets-bundle.js');
const MOCK_NAV = path.join(SCRATCH_DIR, 'mock-nav.ts');
const MOCK_LINK = path.join(SCRATCH_DIR, 'mock-link.tsx');

fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(USER_DATA_DIR, { recursive: true });

function findBuiltCssHref() {
  const cssDir = path.join(WEB_DIR, '.next/static/css');
  if (!fs.existsSync(cssDir)) {
    throw new Error(`Missing CSS dir at ${cssDir}. Run 'pnpm build:prototype' first.`);
  }
  const files = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
  if (files.length === 0) {
    throw new Error('No compiled Next.js CSS files found');
  }
  return files.map((f) => `/_next/static/css/${f}`);
}

const cssHrefs = findBuiltCssHref();
const posixRoot = REPO_ROOT.replace(/\\/g, '/');

// Create mock navigation and link for standalone rendering
fs.writeFileSync(
  MOCK_NAV,
  `export function useRouter() {
  return { push: () => {}, replace: () => {}, back: () => {} };
}
export function usePathname() { return '/pod/pod-042'; }
export function useSearchParams() { return new URLSearchParams(); }
`,
  'utf8',
);

fs.writeFileSync(
  MOCK_LINK,
  `import React from 'react';
export default function Link({ href, children, ...rest }: any) {
  return <a href={href} {...rest}>{children}</a>;
}
`,
  'utf8',
);

// Harness App rendering all 14 states with exact props
fs.writeFileSync(
  HARNESS_ENTRY,
  `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MasukCard } from '${posixRoot}/apps/web/src/components/auth/MasukCard';
import { MatchmakingShell } from '${posixRoot}/apps/web/src/components/matchmaking/MatchmakingShell';
import { CockpitShell } from '${posixRoot}/apps/web/src/components/cockpit/CockpitShell';
import { SummaryShell } from '${posixRoot}/apps/web/src/components/summary/SummaryShell';
import { FakeRealtimeClient } from '${posixRoot}/apps/web/src/features/realtime/fake-client';
import { COPY } from '${posixRoot}/apps/web/src/copy';

function App() {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('scenario') || '01-masuk';
  const [client, setClient] = useState<FakeRealtimeClient | null>(null);

  useEffect(() => {
    let c: FakeRealtimeClient;

    if (scenario === '05-tawaran-bertiga') {
      c = new FakeRealtimeClient({ matchBehavior: 'fallback-offer' });
    } else if (scenario === '09-cockpit-last60s') {
      c = new FakeRealtimeClient({ focusDurationSec: 42 });
    } else {
      c = new FakeRealtimeClient();
    }

    if (scenario === '07-cockpit-lobby') {
      void c.podStart({ podId: 'pod-042' });
    } else if (scenario === '08-cockpit-focus' || scenario === '11-pemandu-sokratik' || scenario === '12-drawer-tablet') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'RESUME' });
      });
    } else if (scenario === '09-cockpit-last60s') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'RESUME' });
      });
    } else if (scenario === '10-cockpit-break') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'SKIP' });
      });
    } else if (scenario === '13-ringkasan-pertanyaan') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        void c.timerControl({ podId: 'pod-042', action: 'END' });
      });
    } else if (scenario === '14-connection-banner') {
      void c.podStart({ podId: 'pod-042' }).then(() => {
        c.setConnectionState('disconnected');
      });
    }

    setClient(c);
    return () => c.dispose();
  }, [scenario]);

  const prototypeNotice = (
    <aside
      aria-label="Status prototipe"
      className="pointer-events-none fixed bottom-2 right-2 z-50 rounded bg-surface/80 px-2 py-0.5 text-[11px] font-mono text-ink-muted border border-border-subtle"
    >
      {COPY.auth.prototypeNotice}
    </aside>
  );

  if (scenario === '01-masuk') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <MasukCard demoModeEnabled={true} />
        {prototypeNotice}
      </main>
    );
  }

  if (!client) {
    return <div id="loading" className="p-4 text-ink-muted">Memuat skenario...</div>;
  }

  if (
    scenario === '02-matchmaking-idle' ||
    scenario === '03-radar-1-of-4' ||
    scenario === '04-radar-3-of-4' ||
    scenario === '05-tawaran-bertiga' ||
    scenario === '06-pod-ditemukan'
  ) {
    return (
      <>
        <MatchmakingShell demoModeEnabled={true} initialClient={client} />
        {prototypeNotice}
      </>
    );
  }

  if (scenario === '13-ringkasan-pertanyaan') {
    return (
      <>
        <SummaryShell podId="pod-042" initialClient={client} />
        {prototypeNotice}
      </>
    );
  }

  return (
    <>
      <CockpitShell podId="pod-042" initialClient={client} />
      {prototypeNotice}
    </>
  );
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
    'next/navigation': MOCK_NAV,
    'next/link': MOCK_LINK,
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
  <title>SyncPod Asset Capture</title>
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
      throw new Error(`Page exception: ${res.exceptionDetails.text ?? JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

// 14 Required States
const STATES = [
  { id: '01-masuk', name: 'Masuk', route: '/masuk', selector: 'button' },
  { id: '02-matchmaking-idle', name: 'Matchmaking idle', route: '/pod', selector: 'button' },
  { id: '03-radar-1-of-4', name: 'Radar 1/4', route: '/pod', selector: '[role="status"]' },
  { id: '04-radar-3-of-4', name: 'Radar 3/4', route: '/pod', selector: '[role="status"]' },
  { id: '05-tawaran-bertiga', name: 'Tawaran bertiga', route: '/pod?scenario=fallback', selector: 'button' },
  { id: '06-pod-ditemukan', name: 'Pod ditemukan', route: '/pod', selector: '[role="status"]' },
  { id: '07-cockpit-lobby', name: 'Cockpit LOBBY', route: '/pod/pod-042', selector: 'main' },
  { id: '08-cockpit-focus', name: 'Cockpit FOCUS tengah', route: '/pod/pod-042', selector: 'main' },
  { id: '09-cockpit-last60s', name: 'Cockpit 60s terakhir', route: '/pod/pod-042', selector: 'main' },
  { id: '10-cockpit-break', name: 'Cockpit BREAK', route: '/pod/pod-042', selector: 'main' },
  { id: '11-pemandu-sokratik', name: 'Pemandu Sokratik', route: '/pod/pod-042', selector: 'main' },
  { id: '12-drawer-tablet', name: 'Drawer tablet', route: '/pod/pod-042', selector: 'main' },
  { id: '13-ringkasan-pertanyaan', name: 'Ringkasan dengan pertanyaan', route: '/pod/pod-042/selesai', selector: 'main' },
  { id: '14-connection-banner', name: 'ConnectionBanner', route: '/pod/pod-042', selector: 'aside[role="status"]' },
];

let chromeProc = null;
let cdp = null;

try {
  console.log(`Starting headless Chrome for asset capture...`);
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

  // Enforce prefers-reduced-motion: reduce
  await cdp.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  async function setViewport(width, height, deviceScaleFactor, mobile = false) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
  }

  async function captureState(state, mode) {
    const isMobile = mode === 'mobile';
    const isTabletDrawer = state.id === '12-drawer-tablet';

    let width = isMobile ? 390 : 1920;
    let height = isMobile ? 844 : 1080;
    let scale = isMobile ? 2 : 1;

    if (isTabletDrawer && !isMobile) {
      width = 768;
      height = 1024;
    }

    await setViewport(width, height, scale, isMobile);

    const url = `http://127.0.0.1:${HARNESS_PORT}/?scenario=${state.id}`;
    await cdp.send('Page.navigate', { url });

    // Wait for document ready
    await wait(350);

    // Specific interactive triggers per state
    if (state.id === '03-radar-1-of-4') {
      await cdp.evalExpr(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cari pod'));
        if (btn) btn.click();
      })()`);
      await wait(300);
    } else if (state.id === '04-radar-3-of-4') {
      await cdp.evalExpr(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cari pod'));
        if (btn) btn.click();
      })()`);
      await wait(2800);
    } else if (state.id === '05-tawaran-bertiga') {
      await cdp.evalExpr(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cari pod'));
        if (btn) btn.click();
      })()`);
      await wait(4500);
    } else if (state.id === '06-pod-ditemukan') {
      await cdp.evalExpr(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cari pod'));
        if (btn) btn.click();
      })()`);
      await wait(4400);
    } else if (state.id === '11-pemandu-sokratik') {
      // Open drawer/panel on desktop or mobile
      await cdp.evalExpr(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const guideBtn = btns.find(b => b.innerText.includes('Pemandu') || b.innerText.includes('Buka pemandu'));
        if (guideBtn) guideBtn.click();
      })()`);
      await wait(300);
    } else if (state.id === '12-drawer-tablet') {
      // Open drawer on tablet or mobile
      await cdp.evalExpr(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const drawerBtn = btns.find(b => b.getAttribute('aria-expanded') !== null || b.innerText.includes('Buka pemandu') || b.innerText.includes('Pemandu'));
        if (drawerBtn) drawerBtn.click();
      })()`);
      await wait(300);
    }

    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const filename = `${mode}-${state.id}.png`;
    const filePath = path.join(ASSETS_DIR, filename);
    const buf = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buf);

    return {
      file: filename,
      state: state.name,
      id: state.id,
      route: state.route,
      viewport: { width, height, deviceScaleFactor: scale, mobile: isMobile },
      sizeBytes: buf.length,
    };
  }

  console.log(`\nCapturing 14 states at Desktop (1920x1080) and Mobile (390x844 @2x)...`);
  const manifestItems = [];

  for (const state of STATES) {
    process.stdout.write(`  Capturing Desktop: ${state.id} ... `);
    const dItem = await captureState(state, 'desktop');
    manifestItems.push(dItem);
    console.log(`OK (${(dItem.sizeBytes / 1024).toFixed(1)} KB)`);

    process.stdout.write(`  Capturing Mobile:  ${state.id} ... `);
    const mItem = await captureState(state, 'mobile');
    manifestItems.push(mItem);
    console.log(`OK (${(mItem.sizeBytes / 1024).toFixed(1)} KB)`);
  }

  // Git SHA
  let gitSha = 'UNKNOWN';
  try {
    gitSha = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {}

  const totalBytes = manifestItems.reduce((acc, item) => acc + item.sizeBytes, 0);
  const totalMB = totalBytes / (1024 * 1024);

  const manifest = {
    generatedAt: new Date().toISOString(),
    gitSha,
    totalFiles: manifestItems.length,
    totalSizeBytes: totalBytes,
    totalSizeMB: parseFloat(totalMB.toFixed(2)),
    assets: manifestItems,
  };

  const manifestPath = path.join(ASSETS_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n========================================`);
  console.log(`Asset Capture Summary:`);
  console.log(`  Total Files: ${manifestItems.length}`);
  console.log(`  Total Size:  ${totalMB.toFixed(2)} MB (Max limit: 6.0 MB)`);
  console.log(`  Git SHA:     ${gitSha}`);
  console.log(`  Manifest:    Docs/semifinal/assets/manifest.json`);
  console.log(`========================================\n`);

  if (totalMB > 6.0) {
    console.error(`FAIL: Total asset size ${totalMB.toFixed(2)} MB exceeds 6.0 MB limit!`);
    process.exit(1);
  }

  console.log(`PASS: All 28 assets captured and verified under 6 MB.`);
  process.exit(0);
} catch (err) {
  console.error('Fatal capture error:', err);
  process.exit(1);
} finally {
  if (cdp) {
    try { cdp.close(); } catch {}
  }
  if (chromeProc) {
    try { chromeProc.kill(); } catch {}
  }
  harnessServer.close();
}
