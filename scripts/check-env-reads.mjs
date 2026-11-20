import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const TARGET_DIRS = [
  path.join(REPO_ROOT, 'apps', 'web', 'src'),
  path.join(REPO_ROOT, 'apps', 'realtime', 'src'),
];

// Documented exceptions from Docs/security/ENV_EXCEPTIONS.md
const ALLOWED_EXCEPTIONS = [
  // env.ts is the schema validator
  { file: 'apps/web/src/env.ts', allow: /process\.env/ },
  { file: 'apps/realtime/src/env.ts', allow: /process\.env/ },
  // Next.js instrumentation hooks
  { file: 'apps/web/src/instrumentation.ts', allow: /process\.env\.NEXT_(RUNTIME|PHASE)/ },
  // Proxy early bypass and secret
  { file: 'apps/web/src/proxy.ts', allow: /process\.env\.(NEXT_PUBLIC_REALTIME_MODE|AUTH_SECRET)/ },
  // Client static inlining expressions
  { file: 'apps/web/src/features/realtime/config.ts', allow: /process\.env\.NEXT_PUBLIC_REALTIME_MODE/ },
  { file: 'apps/web/src/app/masuk/page.tsx', allow: /process\.env\.NEXT_PUBLIC_REALTIME_MODE/ },
  { file: 'apps/web/src/app/pod/page.tsx', allow: /process\.env\.NEXT_PUBLIC_REALTIME_MODE/ },
];

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      out.push(full);
    }
  }
  return out;
}

console.log('=== AUDITING DIRECT process.env READS IN apps/*/src (Gate G9, D40) ===\n');

const violations = [];

for (const targetDir of TARGET_DIRS) {
  const files = walkFiles(targetDir);
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('process.env')) {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Check against allowlist
        const isAllowed = ALLOWED_EXCEPTIONS.some(
          (rule) => rule.file === rel && rule.allow.test(trimmed),
        );

        if (!isAllowed) {
          violations.push({
            file: rel,
            line: lineNum,
            content: trimmed,
          });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`FAIL: Found ${violations.length} unapproved direct process.env reads:`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.content}`);
  }
  process.exit(1);
}

console.log('PASS: All direct process.env reads in apps/*/src strictly match the documented ENV_EXCEPTIONS allowlist.');
console.log('Zero unauthorized process.env reads found.');
