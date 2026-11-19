#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export function maskSensitiveData(content) {
  if (typeof content !== 'string') return content;
  let text = content;

  // 1. Mask Set-Cookie: headers (keep cookie name and standard attributes like Path=..., SameSite=...; mask cookie value)
  text = text.replace(/(\bSet-Cookie:\s*)([^\r\n]+)/gi, (match, prefix, cookieHeader) => {
    const parts = cookieHeader.split(';').map((part, index) => {
      const trimmed = part.trim();
      if (index === 0) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const name = trimmed.slice(0, eqIdx);
          return `${name}=[REDACTED]`;
        }
      }
      return trimmed;
    });
    return `${prefix}${parts.join('; ')}`;
  });

  // 2. Mask Cookie: headers (keep cookie names, mask all values; negative lookbehind prevents matching Set-Cookie:)
  text = text.replace(/(?<!Set-)Cookie:\s*([^\r\n]+)/gi, (match, cookieHeader) => {
    const parts = cookieHeader.split(';').map((part) => {
      const trimmed = part.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const name = trimmed.slice(0, eqIdx);
        return `${name}=[REDACTED]`;
      }
      return trimmed;
    });
    return `Cookie: ${parts.join('; ')}`;
  });

  // 3. Mask *SECRET*=* values (e.g. AUTH_SECRET=..., REALTIME_JWT_SECRET=...)
  text = text.replace(
    /([A-Z0-9_]*SECRET[A-Z0-9_]*\s*=\s*)(["']?)([^"'\s\r\n]+)\2/gi,
    '$1$2[REDACTED]$2',
  );

  // 4. Mask Google Client Secret & API keys
  text = text.replace(/\bGOCSPX-[A-Za-z0-9_-]+\b/g, 'GOCSPX-[REDACTED]');
  text = text.replace(/\bAIza[0-9A-Za-z-_]{35}\b/g, 'AIza[REDACTED]');

  // 5. Mask JWT / JWE tokens: strings starting with ey... with total length > 40 (including dot-separated components)
  text = text.replace(/\bey[A-Za-z0-9_.-]{38,}\b/g, '[REDACTED_JWT]');

  return text;
}

export function formatLogOutput({ command, cwd, startedAt, output, exitCode }) {
  const relCwd = path.relative(REPO_ROOT, cwd) || '.';
  const normalizedCwd = relCwd.replace(/\\/g, '/');
  const masked = maskSensitiveData(output);
  const normalizedOutput = masked.replace(/\r\n/g, '\n');
  const trimmedOutput = normalizedOutput.endsWith('\n')
    ? normalizedOutput
    : normalizedOutput + '\n';

  return (
    `$ ${command}\n` +
    `# cwd ${normalizedCwd}\n` +
    `# started ${startedAt}\n` +
    trimmedOutput +
    `EXIT=${exitCode}\n`
  );
}

export async function runProofCommand({
  dir,
  name,
  commandArgs,
  cwd = REPO_ROOT,
  writeLog = true,
}) {
  const commandStr = commandArgs.join(' ');
  const startedAt = new Date().toISOString();

  // On Windows, paths/arguments with spaces need proper quotes when passed to cmd shell
  const commandLine = commandArgs
    .map((arg) =>
      typeof arg === 'string' && /[\s"]/.test(arg)
        ? `"${arg.replace(/"/g, '\\"')}"`
        : String(arg),
    )
    .join(' ');

  const child = spawn(commandLine, {
    cwd,
    shell: true,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let rawOutput = '';

  child.stdout?.on('data', (chunk) => {
    const str = chunk.toString();
    rawOutput += str;
    process.stdout.write(str);
  });

  child.stderr?.on('data', (chunk) => {
    const str = chunk.toString();
    rawOutput += str;
    process.stderr.write(str);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => {
      resolve(code ?? 0);
    });
    child.on('error', () => {
      resolve(1);
    });
  });

  const formatted = formatLogOutput({
    command: commandStr,
    cwd,
    startedAt,
    output: rawOutput,
    exitCode,
  });

  let logPath = null;
  if (writeLog && dir && name) {
    const proofTargetDir = path.join(REPO_ROOT, 'proof', dir);
    fs.mkdirSync(proofTargetDir, { recursive: true });
    logPath = path.join(proofTargetDir, `${name}.log`);
    fs.writeFileSync(logPath, formatted, 'utf8');
  }

  return { exitCode, formatted, logPath };
}

// CLI entry point
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const dashDashIdx = process.argv.indexOf('--');
  if (dashDashIdx === -1 || dashDashIdx < 3) {
    console.error(
      'Usage: node scripts/proof-run.mjs <dir> <name> -- <command...>\n' +
        'Example: node scripts/proof-run.mjs phase-2d tools -- pnpm test:scripts',
    );
    process.exit(1);
  }

  const dir = process.argv[2];
  const name = process.argv[3];
  const commandArgs = process.argv.slice(dashDashIdx + 1);

  if (commandArgs.length === 0) {
    console.error('Error: No command specified after --');
    process.exit(1);
  }

  runProofCommand({ dir, name, commandArgs })
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error('proof-run failed:', err);
      process.exit(1);
    });
}
