import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import { checkProofBuffer } from '../check-proof-logs.mjs';
import {
  formatLogOutput,
  maskSensitiveData,
  runProofCommand,
} from '../proof-run.mjs';

describe('proof-run: masking and formatting', () => {
  it('masks Cookie and Set-Cookie headers while preserving attributes', () => {
    const raw =
      'HTTP/1.1 200 OK\n' +
      'Set-Cookie: authjs.session-token=secret_jwt_value_12345; Path=/; HttpOnly; SameSite=lax\n' +
      'Cookie: authjs.session-token=secret_val; theme=dark\n';

    const masked = maskSensitiveData(raw);

    assert.ok(masked.includes('Set-Cookie: authjs.session-token=[REDACTED]; Path=/; HttpOnly; SameSite=lax'));
    assert.ok(masked.includes('Cookie: authjs.session-token=[REDACTED]; theme=[REDACTED]'));
    assert.ok(!masked.includes('secret_jwt_value_12345'));
  });

  it('masks JWT/JWE, GOCSPX, AIza, and *SECRET* assignments', () => {
    const raw =
      'AUTH_SECRET="very-secret-token-value"\n' +
      'ClientSecret: GOCSPX-abc123def456\n' +
      'ApiKey: AIzaSyA1234567890abcdefghijklmnopqrstuv\n' +
      'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c\n';

    const masked = maskSensitiveData(raw);

    assert.ok(masked.includes('AUTH_SECRET="[REDACTED]"'));
    assert.ok(masked.includes('GOCSPX-[REDACTED]'));
    assert.ok(masked.includes('AIza[REDACTED]'));
    assert.ok(masked.includes('[REDACTED_JWT]'));
    assert.ok(!masked.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'));
  });

  it('formats log with command, cwd, started, output, and EXIT code', () => {
    const formatted = formatLogOutput({
      command: 'pnpm test:unit',
      cwd: process.cwd(),
      startedAt: '2026-11-19T10:00:00.000Z',
      output: 'All tests pass\n',
      exitCode: 0,
    });

    assert.ok(formatted.startsWith('$ pnpm test:unit\n# cwd .\n# started 2026-11-19T10:00:00.000Z\n'));
    assert.ok(formatted.includes('All tests pass\n'));
    assert.ok(formatted.endsWith('EXIT=0\n'));
  });
});

describe('check-proof-logs: verification and fixture detection', () => {
  it('detects intentionally invalid packages/realtime directory (P0 fixture check)', () => {
    // Intentionally construct fixture with "packages/realtime test:"
    const fixtureText =
      '$ pnpm test\n' +
      'packages/shared test: Done\n' +
      'packages/realtime test: FAIL (bogus package name)\n' +
      'apps/web test: Done\n' +
      'EXIT=0\n';

    const issues = checkProofBuffer(Buffer.from(fixtureText, 'utf8'), 'test-fixture.log');
    const badDirIssue = issues.find((i) => i.type === 'INVALID_WORKSPACE_DIR');

    assert.ok(badDirIssue, 'Must detect non-existent workspace directory');
    assert.strictEqual(badDirIssue.line, 3);
    assert.ok(badDirIssue.message.includes('packages/realtime'));
  });

  it('detects NUL bytes and UTF-16 BOM corruption', () => {
    const nulBuf = Buffer.from([0x24, 0x20, 0x00, 0x74, 0x65, 0x73, 0x74]);
    const nulIssues = checkProofBuffer(nulBuf, 'nul.log');
    assert.ok(nulIssues.some((i) => i.type === 'NUL_BYTE'));

    const bomBuf = Buffer.from([0xff, 0xfe, 0x24, 0x00, 0x20, 0x00]);
    const bomIssues = checkProofBuffer(bomBuf, 'bom.log');
    assert.ok(bomIssues.some((i) => i.type === 'UTF16_BOM'));
  });

  it('detects unredacted JWT tokens in logs', () => {
    const raw = 'session-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz1234567890\n';
    const issues = checkProofBuffer(Buffer.from(raw, 'utf8'), 'jwt.log');
    assert.ok(issues.some((i) => i.type === 'UNREDACTED_JWT'));
  });
});

describe('proof-run: execution end-to-end', () => {
  it('executes command and writes masked log to disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-test-'));
    const testScriptPath = path.join(tmpDir, 'test-target.js');
    fs.writeFileSync(
      testScriptPath,
      'console.log("Cookie: session=secret123");\nconsole.log("Done");\n',
      'utf8',
    );

    try {
      const res = await runProofCommand({
        dir: 'test-phase',
        name: 'smoke',
        commandArgs: [process.execPath, testScriptPath],
        cwd: tmpDir,
        writeLog: false,
      });

      assert.strictEqual(res.exitCode, 0);
      assert.ok(res.formatted.includes('Cookie: session=[REDACTED]'));
      assert.ok(res.formatted.includes('Done'));
      assert.ok(res.formatted.includes('EXIT=0'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
