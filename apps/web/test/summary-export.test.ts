import { describe, expect, it } from 'vitest';
import type { PodSnapshot } from '@syncpod/shared';
import { buildSummaryMarkdown, formatDurationClock } from '../src/features/summary';

describe('sprint summary markdown export (PRD FR-5.1)', () => {
  it('formats durations as MM:SS and HH:MM:SS cleanly', () => {
    expect(formatDurationClock(0)).toBe('00:00');
    expect(formatDurationClock(125)).toBe('02:05');
    expect(formatDurationClock(3661)).toBe('01:01:01');
  });

  it('builds complete Markdown report with module, member durations, Simulasi labels, AI hints, and notes', () => {
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
      ],
    };

    const md = buildSummaryMarkdown({
      snapshot,
      notes: '# Catatan\n- Prioritas jarak minimum.',
      completedAtMs: Date.UTC(2026, 10, 11, 13, 30, 0),
    });

    expect(md).toContain('# Ringkasan Sprint — Traversal Graf dan Dijkstra');
    expect(md).toContain('Struktur Data > Graf > Traversal Graf dan Dijkstra');
    expect(md).toContain('WIB');
    expect(md).toContain('Pertanyaan selesai:** 1/1');
    expect(md).toContain('**Rizqi Pratama**: 20:00');
    expect(md).toContain('**Rifqi Hidayat** (Simulasi): 15:00');
    expect(md).toContain('Mengapa Dijkstra gagal pada bobot negatif?');
    expect(md).toContain('1. Apakah jarak simpul bisa turun setelah pop?');
    expect(md).toContain('CP-Algorithms — Dijkstra');
    expect(md).toContain('# Catatan');
    expect(md).not.toContain('http://');
    expect(md).not.toContain('https://');
  });
});
