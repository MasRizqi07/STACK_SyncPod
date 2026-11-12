import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildSessionSummaryMarkdown,
  formatDurationClock,
  type PodSnapshot,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'summary-golden.md');

describe('buildSessionSummaryMarkdown (D26, PRD FR-5.1)', () => {
  it('matches the golden Markdown file byte-for-byte', () => {
    const golden = fs.readFileSync(GOLDEN_PATH, 'utf8').replace(/\r\n/g, '\n');

    const snapshot: PodSnapshot = {
      podId: 'pod-042',
      module: {
        id: 'mod-dijkstra',
        title: 'Traversal Graf dan Dijkstra',
        path: ['Struktur Data', 'Graf', 'Traversal Graf dan Dijkstra'],
      },
      phase: 'COMPLETED',
      round: 2,
      phaseEndsAt: null,
      pausedRemainingMs: null,
      phaseDurationSec: 60,
      serverNow: Date.UTC(2026, 10, 11, 13, 30, 0),
      leaderId: 'user-rizqi',
      members: [
        {
          userId: 'user-rizqi',
          name: 'Rizqi Pratama',
          role: 'LEADER',
          status: 'IN_FOCUS',
          focusedSec: 1200,
        },
        {
          userId: 'simulasi-1',
          name: 'Rifqi Hidayat',
          role: 'MEMBER',
          status: 'TAKING_NOTES',
          isSimulated: true,
          focusedSec: 900,
        },
      ],
      questions: [
        {
          id: 'q-1',
          podId: 'pod-042',
          authorId: 'user-rizqi',
          authorName: 'Rizqi Pratama',
          text: 'Mengapa Dijkstra gagal pada bobot negatif?',
          resolved: true,
          createdAt: Date.UTC(2026, 10, 11, 13, 10, 0),
          aiHint: {
            concept: 'Asumsi greedy memerlukan panjang jalur monoton naik.',
            guidingQuestions: [
              'Apakah jarak simpul bisa turun setelah pop?',
              'Kapan kondisi relaksasi berulang dibutuhkan?',
              'Apa dampak siklus bobot negatif?',
            ],
            analogy: 'Seperti tarif tol dengan cashback mendadak di segmen akhir.',
            docHint: {
              source: 'CP-Algorithms — Dijkstra',
              searchFor: 'negative edge weights counterexample',
            },
          },
        },
        {
          id: 'q-2',
          podId: 'pod-042',
          authorId: 'simulasi-1',
          authorName: 'Rifqi Hidayat',
          text: 'Bagaimana menangani graf tak terhubung?',
          resolved: false,
          createdAt: Date.UTC(2026, 10, 11, 13, 15, 0),
          aiHint: null,
        },
      ],
    };

    const actual = buildSessionSummaryMarkdown({
      snapshot,
      notes: '# Catatan\n- Prioritas jarak minimum.',
      completedAtMs: Date.UTC(2026, 10, 11, 13, 30, 0),
    });

    expect(actual).toBe(golden);
  });

  it('uses explicit empty-queue wording when no questions exist and formats clock cleanly', () => {
    expect(formatDurationClock(3661)).toBe('01:01:01');
    const md = buildSessionSummaryMarkdown({
      snapshot: {
        podId: 'pod-empty',
        module: { id: 'mod-avl', title: 'AVL Tree', path: ['Struktur Data', 'Pohon', 'AVL Tree'] },
        phase: 'COMPLETED',
        round: 1,
        phaseEndsAt: null,
        pausedRemainingMs: null,
        phaseDurationSec: 60,
        serverNow: Date.UTC(2026, 10, 11, 13, 30, 0),
        leaderId: 'user-1',
        members: [],
        questions: [],
      },
      notes: '   ',
      completedAtMs: Date.UTC(2026, 10, 11, 13, 30, 0),
    });
    expect(md).toContain('Tidak ada pertanyaan di sesi ini.');
    expect(md).toContain('_Tidak ada catatan._');
  });
});
