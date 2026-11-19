#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const LEGACY_DIRS = new Set(['phase-1', 'phase-2a', 'phase-2b', 'phase-2c']);

export function scanProofDirectory(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.log') || entry.name.endsWith('.txt'))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

export function checkProofBuffer(buf, filePath, repoRoot = REPO_ROOT) {
  const issues = [];

  // 1. Check for NUL byte
  if (buf.includes(0)) {
    issues.push({
      type: 'NUL_BYTE',
      message: 'File contains NUL (0x00) bytes (possible UTF-16 or binary corruption)',
    });
  }

  // 2. Check for UTF-16 BOM
  if (
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)
  ) {
    issues.push({
      type: 'UTF16_BOM',
      message: 'File starts with UTF-16 Byte Order Mark (LE or BE)',
    });
  }

  // 3. Check for valid UTF-8 encoding
  let text = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(buf);
  } catch (err) {
    issues.push({
      type: 'INVALID_UTF8',
      message: `Invalid UTF-8 encoding: ${err instanceof Error ? err.message : String(err)}`,
    });
    return issues;
  }

  // 4. Line-by-line checks
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Workspace package directory check: ^(\S+) (typecheck|lint|test|build)[:$]
    const pkgMatch = line.match(/^(\S+) (typecheck|lint|test|build)[:$]/);
    if (pkgMatch) {
      const targetDir = pkgMatch[1];
      const resolvedDir = path.resolve(repoRoot, targetDir);
      if (!fs.existsSync(resolvedDir)) {
        issues.push({
          type: 'INVALID_WORKSPACE_DIR',
          line: lineNum,
          message: `Workspace directory "${targetDir}" does not exist on disk`,
          content: line,
        });
      }
    }

    // Unredacted token check: JWT/JWE > 40 chars (including dot-separated components)
    if (/\bey[A-Za-z0-9_.-]{38,}\b/.test(line)) {
      issues.push({
        type: 'UNREDACTED_JWT',
        line: lineNum,
        message: 'Line contains unmasked JWT/JWE token (> 40 chars)',
        content: line.slice(0, 100),
      });
    }

    // Google API key or OAuth secret check
    if (/\bGOCSPX-[A-Za-z0-9_-]+\b/.test(line)) {
      issues.push({
        type: 'UNREDACTED_SECRET',
        line: lineNum,
        message: 'Line contains unmasked Google client secret (GOCSPX-...)',
        content: line.slice(0, 100),
      });
    }

    if (/\bAIza[0-9A-Za-z-_]{35}\b/.test(line)) {
      issues.push({
        type: 'UNREDACTED_KEY',
        line: lineNum,
        message: 'Line contains unmasked Google API key (AIza...)',
        content: line.slice(0, 100),
      });
    }
  });

  return issues;
}

export function auditProofLogs({
  targetDir = path.join(REPO_ROOT, 'proof'),
  repoRoot = REPO_ROOT,
  strict = false,
}) {
  const files = scanProofDirectory(targetDir);
  const activeIssues = [];
  const legacyIssues = [];

  for (const file of files) {
    const buf = fs.readFileSync(file);
    const issues = checkProofBuffer(buf, file, repoRoot);
    if (issues.length === 0) continue;

    const relPath = path.relative(repoRoot, file).replace(/\\/g, '/');
    const pathParts = relPath.split('/');
    // e.g. proof/phase-1/build.log -> phase-1
    const phaseDir = pathParts.length >= 2 && pathParts[0] === 'proof' ? pathParts[1] : '';
    const isLegacy = !strict && LEGACY_DIRS.has(phaseDir);

    for (const issue of issues) {
      const item = {
        file: relPath,
        phaseDir,
        isLegacy,
        ...issue,
      };
      if (isLegacy) {
        legacyIssues.push(item);
      } else {
        activeIssues.push(item);
      }
    }
  }

  return { filesCount: files.length, activeIssues, legacyIssues };
}

// CLI entry point
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const targetArg = args.find((a) => !a.startsWith('--'));
  const targetDir = targetArg
    ? path.resolve(REPO_ROOT, targetArg)
    : path.join(REPO_ROOT, 'proof');

  console.log(`Scanning proof logs in: ${path.relative(REPO_ROOT, targetDir) || '.'}`);
  const { filesCount, activeIssues, legacyIssues } = auditProofLogs({
    targetDir,
    strict,
  });

  console.log(`Audited ${filesCount} proof file(s).\n`);

  if (legacyIssues.length > 0) {
    console.log('=== HISTORICAL / LEGACY VIOLATIONS REPORT (Informational — Do Not Rewrite History) ===');
    for (const issue of legacyIssues) {
      const lineStr = issue.line ? `:${issue.line}` : '';
      console.log(`  [LEGACY ${issue.type}] ${issue.file}${lineStr}: ${issue.message}`);
    }
    console.log(`Total historical legacy violations: ${legacyIssues.length}\n`);
  }

  if (activeIssues.length > 0) {
    console.error('=== ACTIVE PROOF LOG VIOLATIONS (FAIL) ===');
    for (const issue of activeIssues) {
      const lineStr = issue.line ? `:${issue.line}` : '';
      console.error(`  [FAIL ${issue.type}] ${issue.file}${lineStr}: ${issue.message}`);
      if (issue.content) {
        console.error(`         Line: ${issue.content}`);
      }
    }
    console.error(`\nFound ${activeIssues.length} active violation(s). Exiting with code 1.`);
    process.exit(1);
  }

  console.log('PASS: All active proof logs conform to UTF-8 encoding, valid workspace dirs, and zero token leaks.');
  process.exit(0);
}
