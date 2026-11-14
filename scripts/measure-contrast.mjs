import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = 'D:/MY CODE/STACK_SyncPod';
const PROOF_DIR = path.join(REPO_ROOT, 'proof/phase-2c');

fs.mkdirSync(PROOF_DIR, { recursive: true });

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function sRgbToLinear(channel255) {
  const norm = channel255 / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function calculateContrastRatio(hex1, hex2) {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = {
  '--bg-canvas': '#090D16',
  '--bg-surface': '#0F172A',
  '--bg-surface-elevated': '#1E293B',
  '--color-primary': '#38BDF8',
  '--color-primary-hover': '#0EA5E9',
  '--color-on-primary': '#04121F',
  '--color-amber': '#F59E0B',
  '--color-emerald': '#10B981',
  '--color-purple-text': '#C084FC',
  '--color-danger': '#F87171',
  '--text-primary': '#F8FAFC',
  '--text-secondary': '#94A3B8',
  '--text-muted': '#8393A8',
};

const checks = [
  {
    name: 'Primary text on canvas background',
    fg: '--text-primary',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Primary text on surface background',
    fg: '--text-primary',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Primary text on elevated surface',
    fg: '--text-primary',
    bg: '--bg-surface-elevated',
    minRatio: 4.5,
  },
  {
    name: 'Secondary text on canvas background',
    fg: '--text-secondary',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Secondary text on surface background',
    fg: '--text-secondary',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Secondary text on elevated surface',
    fg: '--text-secondary',
    bg: '--bg-surface-elevated',
    minRatio: 4.5,
  },
  {
    name: 'Muted text on canvas background',
    fg: '--text-muted',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Muted text on surface background',
    fg: '--text-muted',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Muted text on elevated surface',
    fg: '--text-muted',
    bg: '--bg-surface-elevated',
    minRatio: 4.5,
  },
  {
    name: 'Button text (on-primary) on primary button',
    fg: '--color-on-primary',
    bg: '--color-primary',
    minRatio: 4.5,
  },
  {
    name: 'Button text (on-primary) on primary hover',
    fg: '--color-on-primary',
    bg: '--color-primary-hover',
    minRatio: 4.5,
  },
  {
    name: 'Primary accent text on canvas',
    fg: '--color-primary',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Primary accent text on surface',
    fg: '--color-primary',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Emerald status text on surface (TAKING_NOTES)',
    fg: '--color-emerald',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Emerald status text on canvas (TAKING_NOTES)',
    fg: '--color-emerald',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Purple status text on surface (ASKING_GEMINI)',
    fg: '--color-purple-text',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Purple status text on canvas (ASKING_GEMINI)',
    fg: '--color-purple-text',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Danger text on surface (Error / End sprint)',
    fg: '--color-danger',
    bg: '--bg-surface',
    minRatio: 4.5,
  },
  {
    name: 'Danger text on canvas (Error / End sprint)',
    fg: '--color-danger',
    bg: '--bg-canvas',
    minRatio: 4.5,
  },
  {
    name: 'Amber accent on canvas (Break UI ring indicator)',
    fg: '--color-amber',
    bg: '--bg-canvas',
    minRatio: 3.0,
  },
];

const lines = [];
lines.push('========================================================================================');
lines.push('SYNCPOD DESIGN TOKEN CONTRAST AUDIT (WCAG 2.1 AA Standard)');
lines.push('Formula: WCAG 2.1 Relative Luminance (L = 0.2126*R + 0.7152*G + 0.0722*B)');
lines.push('Generated: ' + new Date().toISOString());
lines.push('========================================================================================\n');

let allPassed = true;

for (const check of checks) {
  const fgHex = tokens[check.fg];
  const bgHex = tokens[check.bg];
  const ratio = calculateContrastRatio(fgHex, bgHex);
  const passed = ratio >= check.minRatio;
  if (!passed) allPassed = false;

  const statusStr = passed ? 'PASS' : 'FAIL';
  lines.push(
    `[${statusStr}] ${check.name}\n` +
      `       Foreground: ${check.fg} (${fgHex})\n` +
      `       Background: ${check.bg} (${bgHex})\n` +
      `       Contrast Ratio: ${ratio.toFixed(2)}:1 (Required: >= ${check.minRatio.toFixed(1)}:1)\n`,
  );
}

lines.push('========================================================================================');
lines.push(`AUDIT RESULT: ${allPassed ? 'ALL PASS (WCAG 2.1 AA Compliant)' : 'FAILURES DETECTED'}`);
lines.push('========================================================================================');

const output = lines.join('\n') + '\n';
fs.writeFileSync(path.join(PROOF_DIR, 'contrast.log'), output, 'utf8');
console.log(output);

if (!allPassed) {
  process.exitCode = 1;
}

