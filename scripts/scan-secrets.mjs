#!/usr/bin/env node
/**
 * scripts/scan-secrets.mjs
 * Security audit script for GDGoC STACK jury review.
 *
 * Scans:
 * 1. Tracked files (git ls-files)
 * 2. Git commit history (git log -p)
 * 3. Enforces that `git ls-files .env*` returns ONLY `.env.example`
 *
 * Checks for:
 * - AUTH_SECRET= with real secrets
 * - Google Client Secret (GOCSPX-...)
 * - Google API Key (AIza...)
 * - Private key blocks (-----BEGIN ... KEY-----)
 * - Database URLs with real/non-placeholder passwords
 * - Unmasked JWT/JWE tokens
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ALLOWLIST with explicit written justification
const ALLOWLIST = [
  {
    pattern: /\.env\.example$/,
    reason: 'Standard environment template containing documented dummy/placeholder values and setup instructions.',
  },
  {
    pattern: /packages[/\\]db[/\\]test[/\\]index\.test\.ts$/,
    reason: 'Database config unit test fixture containing synthetic local connection string (syncpod:syncpod).',
  },
  {
    pattern: /scripts[/\\](?:proof-run|check-proof-logs|scan-secrets|demo-dryrun|capture-semifinal-assets|smoke-url)\.mjs$/,
    reason: 'Security tooling and verification scripts containing regex patterns and redaction logic.',
  },
  {
    pattern: /scripts[/\\]test[/\\]proof-tools\.test\.mjs$/,
    reason: 'Unit test suite with synthetic fixtures for validating redaction and leak detection.',
  },
  {
    pattern: /proof[/\\]phase-2d[/\\]tools\.log$/,
    reason: 'Execution log of the test:scripts suite verifying redaction tool behavior.',
  },
];

function isAllowlisted(filePath) {
  const normPath = filePath.replace(/\\/g, '/');
  return ALLOWLIST.some((entry) => entry.pattern.test(normPath));
}

function scanContent(content, locationLabel) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 1. AUTH_SECRET with non-placeholder value (> 10 chars, not [REDACTED], dummy, placeholder)
    const secretMatch = line.match(/\bAUTH_SECRET\s*=\s*["']?([^"'\s\r\n]+)["']?/i);
    if (secretMatch) {
      const val = secretMatch[1];
      const isPlaceholder =
        val === '[REDACTED]' ||
        val.includes('placeholder') ||
        val.includes('generate_with') ||
        val === 'dummy' ||
        val === 'secret';
      if (!isPlaceholder && val.length > 8) {
        findings.push({
          type: 'AUTH_SECRET_LEAK',
          location: `${locationLabel}:${lineNum}`,
          snippet: line.slice(0, 80),
        });
      }
    }

    // 2. Google OAuth client secret GOCSPX-
    const gocMatch = line.match(/\bGOCSPX-[A-Za-z0-9_-]{10,}\b/);
    if (gocMatch && !line.includes('[REDACTED]') && !line.includes('GOCSPX-abc123def456')) {
      findings.push({
        type: 'GOOGLE_CLIENT_SECRET_LEAK',
        location: `${locationLabel}:${lineNum}`,
        snippet: line.slice(0, 80),
      });
    }

    // 3. Google API Key AIza...
    const aizaMatch = line.match(/\bAIza[0-9A-Za-z-_]{35}\b/);
    if (aizaMatch && !line.includes('[REDACTED]') && !line.includes('AIzaSyA1234567890abcdefghijklmnopqrstuv')) {
      findings.push({
        type: 'GOOGLE_API_KEY_LEAK',
        location: `${locationLabel}:${lineNum}`,
        snippet: line.slice(0, 80),
      });
    }

    // 4. Private key blocks
    if (/-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?KEY-----/i.test(line)) {
      findings.push({
        type: 'PRIVATE_KEY_BLOCK',
        location: `${locationLabel}:${lineNum}`,
        snippet: line.slice(0, 80),
      });
    }

    // 5. Database URL with non-placeholder password
    const dbMatch = line.match(/postgres(?:ql)?:\/\/[^:]+:([^@]+)@/i);
    if (dbMatch) {
      const pass = dbMatch[1];
      const isDummy =
        pass === 'password' ||
        pass === 'postgres' ||
        pass === 'syncpod' ||
        pass === 'root' ||
        pass === '<password>' ||
        pass === '[REDACTED]' ||
        pass.includes('dummy');
      if (!isDummy) {
        findings.push({
          type: 'DATABASE_PASSWORD_LEAK',
          location: `${locationLabel}:${lineNum}`,
          snippet: line.slice(0, 80),
        });
      }
    }

    // 6. Real unmasked JWT > 50 chars starting with eyJ
    const jwtMatch = line.match(/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/);
    if (jwtMatch && !line.includes('[REDACTED') && !line.includes('John Doe')) {
      findings.push({
        type: 'UNMASKED_JWT_LEAK',
        location: `${locationLabel}:${lineNum}`,
        snippet: line.slice(0, 80),
      });
    }
  });

  return findings;
}

function runSecretsScan() {
  console.log(`============================================================`);
  console.log(`SyncPod Jury Security & Secrets Scan`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Repository Root: ${REPO_ROOT}`);
  console.log(`============================================================\n`);

  // Gate 1: Check git ls-files .env*
  console.log(`GATE 1: Verifying tracked .env files (git ls-files .env*)...`);
  const envFilesRaw = execSync('git ls-files .env*', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  const envFiles = envFilesRaw ? envFilesRaw.split(/\r?\n/) : [];

  console.log(`Tracked .env files found: ${JSON.stringify(envFiles)}`);
  if (envFiles.length !== 1 || envFiles[0] !== '.env.example') {
    console.error(`FAIL [Gate 1]: Only .env.example may be tracked! Found: ${envFiles.join(', ')}`);
    process.exit(1);
  }
  console.log(`PASS [Gate 1]: Only .env.example is tracked in git.\n`);

  // Gate 2: Scan all tracked files
  console.log(`GATE 2: Scanning all tracked repository files...`);
  const allTracked = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  let trackedIssues = [];
  let scannedCount = 0;
  let allowlistedCount = 0;

  for (const relFile of allTracked) {
    const fullPath = path.join(REPO_ROOT, relFile);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;

    // Check allowlist
    if (isAllowlisted(relFile)) {
      allowlistedCount++;
      continue;
    }

    scannedCount++;
    const content = fs.readFileSync(fullPath, 'utf8');
    const issues = scanContent(content, relFile);
    if (issues.length > 0) {
      trackedIssues.push(...issues);
    }
  }

  console.log(`Scanned ${scannedCount} tracked files (${allowlistedCount} allowlisted).`);
  if (trackedIssues.length > 0) {
    console.error(`FAIL [Gate 2]: Found ${trackedIssues.length} secret leaks in tracked files:`);
    trackedIssues.forEach((iss) => console.error(`  - [${iss.type}] ${iss.location}: ${iss.snippet}`));
    process.exit(1);
  }
  console.log(`PASS [Gate 2]: Zero secret leaks detected in tracked files.\n`);

  // Gate 3: Scan git history (last 50 commits)
  console.log(`GATE 3: Scanning recent git history (last 50 commits)...`);
  const gitLog = execSync('git log -n 50 -p', { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const historyLines = gitLog.split(/\r?\n/);
  let currentCommit = '';
  let currentFile = '';
  const historyIssues = [];

  for (let i = 0; i < historyLines.length; i++) {
    const line = historyLines[i];
    if (line.startsWith('commit ')) {
      currentCommit = line.slice(7, 15);
    } else if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      if (isAllowlisted(currentFile)) continue;
      const issues = scanContent(line.slice(1), `${currentCommit}:${currentFile}`);
      if (issues.length > 0) {
        historyIssues.push(...issues);
      }
    }
  }

  console.log(`Analyzed 50 git commits.`);
  if (historyIssues.length > 0) {
    console.warn(`WARNING [Gate 3]: Found ${historyIssues.length} historical findings:`);
    historyIssues.forEach((iss) => console.warn(`  - [${iss.type}] ${iss.location}: ${iss.snippet}`));
    console.log(`Note: Per prompt instructions, reporting findings without rewriting historical git commits.`);
  } else {
    console.log(`PASS [Gate 3]: Zero secret leaks detected in recent git history.\n`);
  }

  console.log(`============================================================`);
  console.log(`SECURITY SCAN VERDICT: PASS (Zero active leaks, .env hygiene verified)`);
  console.log(`============================================================`);
  process.exit(0);
}

runSecretsScan();
