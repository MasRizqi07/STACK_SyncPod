import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PROOF_DIR = path.join(REPO_ROOT, 'proof/browser-audit');
const SCRATCH_DIR = path.join(REPO_ROOT, '.scratch/chrome-audit-profile');

const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9336;
const BASE_URL = 'http://localhost:3005';

fs.mkdirSync(PROOF_DIR, { recursive: true });
fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.consoleLogs = [];
    this.pageErrors = [];
    this.networkErrors = [];
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
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
          this.consoleLogs.push({ type: msg.params.type, text });
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          this.pageErrors.push(msg.params.exceptionDetails);
        }
        if (msg.method === 'Network.responseReceived') {
          const status = msg.params.response.status;
          if (status >= 400 && !msg.params.response.url.endsWith('favicon.ico')) {
            this.networkErrors.push({ url: msg.params.response.url, status });
          }
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
      throw new Error(
        `Page exception: ${res.exceptionDetails.text ?? JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function runAudit() {
  console.log('=== STARTING SYNCPOD FULL BROWSER AUDIT ===');
  console.log(`Target Server: ${BASE_URL}`);

  // Test server connectivity
  const masukRes = await fetch(`${BASE_URL}/masuk`);
  console.log(`Server /masuk status: ${masukRes.status} ${masukRes.statusText}`);

  // Launch Chrome
  console.log(`Launching dedicated Chrome headless: ${CHROME_PATH}`);
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${SCRATCH_DIR}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const auditReport = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: {},
    functionalTests: [],
    overflowChecks: [],
    a11yChecks: [],
    consoleErrors: [],
    networkFailures: [],
    passed: true,
  };

  try {
    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, 15000);
    const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Could not find Chrome page target');
    }

    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    async function setViewport(width, height) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
    }

    async function waitForSelector(selector, timeoutMs = 12000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = await cdp.evalExpr(
          `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
        );
        if (found) {
          await wait(200);
          return true;
        }
        await wait(150);
      }
      throw new Error(`Timeout waiting for selector: ${selector}`);
    }

    async function screenshot(filename) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const filepath = path.join(PROOF_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
      console.log(`[SCREENSHOT] Saved: ${filename}`);
      return filepath;
    }

    async function checkA11y(pageName) {
      const issues = await cdp.evalExpr(`(() => {
        const issues = [];
        // Check buttons
        document.querySelectorAll('button').forEach((b) => {
          const txt = (b.innerText || b.getAttribute('aria-label') || '').trim();
          if (!txt) issues.push({ type: 'button-no-name', html: b.outerHTML.slice(0, 100) });
        });
        // Check inputs
        document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((inp) => {
          const id = inp.id;
          const hasLabel = id ? document.querySelector('label[for="' + id + '"]') : inp.closest('label');
          const hasAria = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
          if (!hasLabel && !hasAria) {
            issues.push({ type: 'input-no-label', id: inp.id, name: inp.name });
          }
        });
        return issues;
      })()`);

      auditReport.a11yChecks.push({ page: pageName, issuesCount: issues.length, issues });
      return issues;
    }

    async function checkOverflow(pageName) {
      const overflow = await cdp.evalExpr(
        `({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, hasOverflow: document.documentElement.scrollWidth > window.innerWidth })`,
      );
      auditReport.overflowChecks.push({
        page: pageName,
        scrollW: overflow.scrollW,
        innerW: overflow.innerW,
        overflow: overflow.hasOverflow,
      });
      if (overflow.hasOverflow) {
        console.warn(`[OVERFLOW DETECTED] on ${pageName}: scrollW=${overflow.scrollW} > innerW=${overflow.innerW}`);
      } else {
        console.log(`[OVERFLOW PASS] on ${pageName}: ${overflow.scrollW}px <= ${overflow.innerW}px`);
      }
      return overflow;
    }

    // ==========================================
    // STEP 1: AUDIT /masuk (Auth & Demo Access)
    // ==========================================
    console.log('\n--- 1. AUDITING /masuk ---');
    await setViewport(1280, 800);
    await cdp.send('Page.navigate', { url: `${BASE_URL}/masuk` });
    await waitForSelector('main, h1, button');
    await wait(600);

    const masukDetails = await cdp.evalExpr(`({
      title: document.title,
      heading: document.querySelector('h1')?.innerText || '',
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()),
      prototypeBadge: Boolean(document.body.innerText.includes('Prototipe: data simulasi')),
      hasGoogleButton: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Google'))),
      hasDemoProfiles: Boolean(document.body.innerText.includes('akun demo')),
    })`);
    console.log('Masuk details:', masukDetails);
    auditReport.pages['/masuk'] = masukDetails;

    await checkOverflow('masuk-desktop');
    await checkA11y('masuk');
    await screenshot('01a-masuk-desktop.png');

    await setViewport(375, 667);
    await wait(300);
    await checkOverflow('masuk-mobile');
    await screenshot('01b-masuk-mobile.png');
    await setViewport(1280, 800);

    // ==========================================
    // STEP 2: AUDIT /pod (Matchmaking Shell)
    // ==========================================
    console.log('\n--- 2. AUDITING /pod (Matchmaking Shell) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/pod` });
    await waitForSelector('main, h1, [role="tree"], input[type="search"]');
    await wait(600);

    const podLobbyDetails = await cdp.evalExpr(`({
      title: document.title,
      heading: document.querySelector('h1')?.innerText || '',
      hasModuleCatalog: Boolean(document.querySelector('input[type="search"]')),
      hasUrgencyChips: Array.from(document.querySelectorAll('button')).filter(b => ['Ujian', 'Tugas', 'Teori'].some(t => b.innerText.includes(t))).length > 0,
      hasPodRingSeats: Boolean(document.querySelector('svg')),
      searchButtonText: Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cari Pod') || b.innerText.includes('Mulai'))?.innerText || null,
      seatsLabel: document.body.innerText.match(/Kursi [0-9]\\/[0-9] terisi/)?.[0] || 'Unknown',
    })`);
    console.log('Matchmaking lobby details:', podLobbyDetails);
    auditReport.pages['/pod'] = podLobbyDetails;

    await checkOverflow('pod-matchmaking-desktop');
    await checkA11y('pod-matchmaking');
    await screenshot('02a-pod-matchmaking-desktop.png');

    // Test Module Search Filtering
    console.log('Testing Module Catalog search filtering...');
    const searchFilterResult = await cdp.evalExpr(`(() => {
      const searchInput = document.querySelector('input[type="search"]');
      if (!searchInput) return { found: false };
      searchInput.value = 'Dijkstra';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, val: searchInput.value };
    })()`);
    await wait(400);
    console.log('Search filter typed:', searchFilterResult);
    await screenshot('02b-pod-module-filtered.png');

    // Test Urgency Chip Click
    console.log('Testing Urgency selection...');
    const urgencyClick = await cdp.evalExpr(`(() => {
      const chips = Array.from(document.querySelectorAll('button'));
      const chip = chips.find(b => b.innerText.includes('Buntu di tugas') || b.innerText.includes('Tugas'));
      if (chip) {
        chip.click();
        return { clicked: true, text: chip.innerText };
      }
      return { clicked: false };
    })()`);
    console.log('Urgency chip click:', urgencyClick);
    await wait(300);

    // Mobile Viewport for Matchmaking
    await setViewport(375, 667);
    await wait(300);
    await checkOverflow('pod-matchmaking-mobile');
    await screenshot('02c-pod-matchmaking-mobile.png');
    await setViewport(1280, 800);

    // Trigger Matchmaking Radar Search
    console.log('Triggering "Cari pod" Radar Search...');
    const triggerSearch = await cdp.evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.innerText.toLowerCase().includes('cari pod'));
      if (startBtn && !startBtn.disabled) {
        startBtn.click();
        return { clicked: true, text: startBtn.innerText };
      }
      return { clicked: false, foundBtn: Boolean(startBtn), disabled: startBtn?.disabled };
    })()`);
    console.log('Search radar clicked:', triggerSearch);
    await wait(1200);
    await screenshot('02d-pod-matchmaking-searching-radar.png');

    // Wait for seats to fill up in fake mode (simulates peers joining 1->2->3->4)
    console.log('Waiting for peer matching simulation (4 seats)...');
    await wait(3500);
    await screenshot('02e-pod-matchmaking-matched-countdown.png');

    // ==========================================
    // STEP 3: AUDIT /pod/pod-042 (Cockpit Sprint Pod)
    // ==========================================
    console.log('\n--- 3. AUDITING /pod/pod-042 (Cockpit Sprint Pod) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/pod/pod-042` });
    await waitForSelector('main, svg, textarea');
    await wait(800);

    const cockpitDetails = await cdp.evalExpr(`({
      title: document.title,
      podTitle: document.querySelector('h1, h2')?.innerText || '',
      hasTimerSVG: Boolean(document.querySelector('svg circle')),
      timerText: document.querySelector('[role="timer"], .font-mono')?.innerText || '',
      phaseBadge: Array.from(document.querySelectorAll('span, div')).find(el => el.innerText.trim() === 'FOKUS' || el.innerText.trim() === 'ISTIRAHAT')?.innerText || '',
      roundInfo: document.body.innerText.match(/Putaran [0-9]/)?.[0] || '',
      hasNotesEditor: Boolean(document.querySelector('textarea')),
      hasAIAdvisor: Boolean(document.body.innerText.includes('Panduan Sokratik') || document.body.innerText.includes('AI') || document.body.innerText.includes('Asisten')),
      membersCount: document.querySelectorAll('[data-testid="member-row"], li').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
    })`);
    console.log('Cockpit details:', cockpitDetails);
    auditReport.pages['/pod/pod-042'] = cockpitDetails;

    await checkOverflow('cockpit-desktop');
    await checkA11y('cockpit');
    await screenshot('03a-cockpit-sprint-desktop.png');

    // Functional Test 3A: Live Notes Typing in Scratchpad
    console.log('Testing live notes typing in ScratchpadEditor...');
    const typingResult = await cdp.evalExpr(`(() => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return { success: false, reason: 'textarea not found' };
      const originalValue = textarea.value;
      textarea.value = originalValue + '\\n\\n### Verifikasi Algoritma Dijkstra\\n- Menggunakan Priority Queue (Min-Heap)\\n- Invariant: Relaksasi edge dengan jarak terpendek';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, length: textarea.value.length };
    })()`);
    console.log('Notes typing result:', typingResult);
    auditReport.functionalTests.push({ test: 'cockpit-notes-typing', ...typingResult });
    await wait(400);
    await screenshot('03b-cockpit-notes-typed.png');

    // Functional Test 3B: Timer Pause and Resume
    console.log('Testing Timer Pause control...');
    const pauseClick = await cdp.evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pauseBtn = buttons.find(b => b.innerText.includes('Jeda') || b.getAttribute('aria-label')?.includes('Jeda'));
      if (pauseBtn) {
        pauseBtn.click();
        return { clicked: true, label: pauseBtn.innerText || pauseBtn.getAttribute('aria-label') };
      }
      return { clicked: false, availableButtons: buttons.map(b => b.innerText) };
    })()`);
    console.log('Pause click:', pauseClick);
    await wait(600);
    await screenshot('03c-cockpit-timer-paused.png');

    console.log('Testing Timer Resume control...');
    const resumeClick = await cdp.evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const resumeBtn = buttons.find(b => b.innerText.includes('Lanjut') || b.getAttribute('aria-label')?.includes('Lanjut'));
      if (resumeBtn) {
        resumeBtn.click();
        return { clicked: true, label: resumeBtn.innerText || resumeBtn.getAttribute('aria-label') };
      }
      return { clicked: false };
    })()`);
    console.log('Resume click:', resumeClick);
    await wait(600);
    await screenshot('03d-cockpit-timer-resumed.png');

    // Mobile Viewport for Cockpit
    console.log('Testing Cockpit mobile responsive view & tabs...');
    await setViewport(375, 667);
    await wait(400);
    await checkOverflow('cockpit-mobile');
    await screenshot('03e-cockpit-mobile.png');

    // Test mobile tab navigation if tabs exist
    const mobileTabClick = await cdp.evalExpr(`(() => {
      const tabButtons = Array.from(document.querySelectorAll('button')).filter(b => ['Catatan', 'Antrean', 'Panduan', 'Pod'].some(t => b.innerText.includes(t)));
      if (tabButtons.length > 1) {
        tabButtons[1].click();
        return { switchedTab: true, tab: tabButtons[1].innerText };
      }
      return { switchedTab: false };
    })()`);
    console.log('Mobile tab click:', mobileTabClick);
    await wait(300);
    await screenshot('03f-cockpit-mobile-tab2.png');
    await setViewport(1280, 800);

    // ==========================================
    // STEP 4: AUDIT /pod/pod-042/selesai (Summary Shell)
    // ==========================================
    console.log('\n--- 4. AUDITING /pod/pod-042/selesai (Summary Shell) ---');
    await cdp.send('Page.navigate', { url: `${BASE_URL}/pod/pod-042/selesai` });
    await waitForSelector('main, h1, h2, button');
    await wait(800);

    const summaryDetails = await cdp.evalExpr(`({
      title: document.title,
      heading: document.querySelector('h1, h2')?.innerText || '',
      moduleTitle: document.body.innerText.match(/Dijkstra|Algoritma|Struktur Data/)?.[0] || '',
      hasStatsSection: Boolean(document.body.innerText.includes('Fokus') || document.body.innerText.includes('Putaran') || document.body.innerText.includes('Pertanyaan')),
      hasNotesPreview: Boolean(document.querySelector('.prose, pre, [data-testid="markdown-preview"]') || document.body.innerText.includes('Catatan')),
      hasExportButtons: Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Salin') || b.innerText.includes('Unduh') || b.innerText.includes('Markdown')).length > 0,
      hasPeerEndorsement: Boolean(document.body.innerText.includes('Endorsement') || document.body.innerText.includes('Keahlian') || document.body.innerText.includes('Apresiasi')),
      actionButtons: Array.from(document.querySelectorAll('button, a')).map(el => el.innerText.trim()).filter(Boolean),
    })`);
    console.log('Summary details:', summaryDetails);
    auditReport.pages['/pod/pod-042/selesai'] = summaryDetails;

    await checkOverflow('summary-desktop');
    await checkA11y('summary');
    await screenshot('04a-summary-desktop.png');

    // Functional Test 4A: Export Markdown Copy/Download
    console.log('Testing Export Markdown button...');
    const exportClick = await cdp.evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dlBtn = buttons.find(b => b.innerText.includes('Unduh') || b.innerText.includes('Salin') || b.innerText.includes('Markdown'));
      if (dlBtn) {
        dlBtn.click();
        return { clicked: true, text: dlBtn.innerText };
      }
      return { clicked: false, available: buttons.map(b => b.innerText) };
    })()`);
    console.log('Export button click:', exportClick);
    auditReport.functionalTests.push({ test: 'summary-export-click', ...exportClick });
    await wait(500);
    await screenshot('04b-summary-export-triggered.png');

    // Mobile Viewport for Summary
    await setViewport(375, 667);
    await wait(300);
    await checkOverflow('summary-mobile');
    await screenshot('04c-summary-mobile.png');
    await setViewport(1280, 800);

    // ==========================================
    // STEP 5: OVERALL HEALTH & SECURITY EVALUATION
    // ==========================================
    auditReport.consoleErrors = cdp.pageErrors;
    auditReport.networkFailures = cdp.networkErrors;
    auditReport.allConsoleLogs = cdp.consoleLogs;

    console.log('\n==========================================');
    console.log('--- SYNCPOD BROWSER AUDIT SUMMARY ---');
    console.log(`Routes Audited: ${Object.keys(auditReport.pages).length}`);
    console.log(`Functional Interactivity Tests: ${auditReport.functionalTests.length}`);
    console.log(`Overflow Checks Passed: ${auditReport.overflowChecks.filter(c => !c.overflow).length}/${auditReport.overflowChecks.length}`);
    console.log(`Accessibility Checks: ${auditReport.a11yChecks.map(c => `${c.page}: ${c.issuesCount} issues`).join(', ')}`);
    console.log(`Page Runtime Errors: ${cdp.pageErrors.length}`);
    console.log(`Network Failures: ${cdp.networkErrors.length}`);

    if (cdp.pageErrors.length > 0) {
      console.error('[FAIL] Runtime errors detected on page:', cdp.pageErrors);
      auditReport.passed = false;
    }
    const anyOverflow = auditReport.overflowChecks.some(c => c.overflow);
    if (anyOverflow) {
      console.warn('[WARN] Horizontal overflow detected in some viewports.');
    }

    const reportFile = path.join(PROOF_DIR, 'full-browser-audit.json');
    fs.writeFileSync(reportFile, JSON.stringify(auditReport, null, 2), 'utf-8');
    console.log(`Saved comprehensive audit report JSON: ${reportFile}`);

    cdp.close();
  } catch (err) {
    console.error('Audit encountered fatal error:', err);
    auditReport.passed = false;
    auditReport.fatalError = err.message;
  } finally {
    if (chromeProc) {
      chromeProc.kill('SIGTERM');
      console.log('Chrome headless process terminated.');
    }
  }

  return auditReport;
}

runAudit().then((rep) => {
  console.log(`\nAUDIT RUN COMPLETE. Success = ${rep.passed}`);
  process.exit(rep.passed ? 0 : 1);
});
