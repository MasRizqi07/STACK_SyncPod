import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const targetPhase = process.argv[2] || 'phase-3b';
const proofDir = path.join(REPO_ROOT, 'proof', targetPhase);
fs.mkdirSync(proofDir, { recursive: true });

const logPath = path.join(proofDir, 'mem.log');

let memOutput = '';
try {
  memOutput = execSync(
    'powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem) | Select-Object TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory | Format-List"',
    { encoding: 'utf8' },
  );
} catch (err) {
  memOutput = `Failed to get CIM instance: ${err.message}\n`;
}

const entry =
  `$ node scripts/record-mem.mjs ${targetPhase}\n` +
  `# started ${new Date().toISOString()}\n` +
  memOutput.trim() +
  '\nEXIT=0\n';

fs.appendFileSync(logPath, entry, 'utf8');
console.log(memOutput.trim());
