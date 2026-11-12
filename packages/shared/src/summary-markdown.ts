import type { PodSnapshot } from './types.js';

export interface SessionSummaryMarkdownInput {
  snapshot: PodSnapshot;
  notes: string;
  completedAtMs: number;
}

const LABELS = {
  simulatedBadge: 'Simulasi',
  queueResolved: 'Selesai',
  unresolvedTag: 'Belum selesai',
  questionsEmpty: 'Tidak ada pertanyaan di sesi ini.',
  guideConceptLabel: 'Konsep kunci',
  guideQuestionsLabel: 'Tiga pertanyaan pemandu',
  guideAnalogyLabel: 'Analogi konseptual',
  guideDocHintLabel: 'Rujukan dokumentasi resmi',
  noHintYet: 'Belum ada petunjuk pemandu.',
} as const;

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatSummaryDate(epochMs: number): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(epochMs)) + ' WIB'
  );
}

export function buildSessionSummaryMarkdown(summary: SessionSummaryMarkdownInput): string {
  const { snapshot, notes, completedAtMs } = summary;
  const resolvedCount = snapshot.questions.filter((q) => q.resolved).length;
  const lines: string[] = [
    `# Ringkasan Sprint — ${snapshot.module.title}`,
    '',
    `- **Modul:** ${snapshot.module.path.join(' > ')}`,
    `- **Pod:** ${snapshot.podId}`,
    `- **Tanggal:** ${formatSummaryDate(completedAtMs)}`,
    `- **Pertanyaan selesai:** ${resolvedCount}/${snapshot.questions.length}`,
    '',
    '## Durasi Fokus per Anggota',
    '',
    ...snapshot.members.map((member) => {
      const duration = formatDurationClock(member.focusedSec ?? 0);
      const badge = member.isSimulated ? ` (${LABELS.simulatedBadge})` : '';
      return `- **${member.name}**${badge}: ${duration}`;
    }),
    '',
    '## Antrean Pertanyaan & Petunjuk Pemandu',
    '',
  ];

  if (snapshot.questions.length === 0) {
    lines.push(LABELS.questionsEmpty, '');
  } else {
    snapshot.questions.forEach((question, index) => {
      const statusText = question.resolved ? LABELS.queueResolved : LABELS.unresolvedTag;
      lines.push(
        `### Q${index + 1}. ${question.text}`,
        `- Penulis: ${question.authorName} · Status: ${statusText}`,
        '',
      );
      if (question.aiHint) {
        lines.push(
          `**${LABELS.guideConceptLabel}:** ${question.aiHint.concept}`,
          '',
          `**${LABELS.guideQuestionsLabel}:**`,
          `1. ${question.aiHint.guidingQuestions[0]}`,
          `2. ${question.aiHint.guidingQuestions[1]}`,
          `3. ${question.aiHint.guidingQuestions[2]}`,
          '',
          `**${LABELS.guideAnalogyLabel}:** ${question.aiHint.analogy}`,
          '',
        );
        if (question.aiHint.docHint) {
          lines.push(
            `**${LABELS.guideDocHintLabel}:** ${question.aiHint.docHint.source} — \`${question.aiHint.docHint.searchFor}\``,
            '',
          );
        }
      } else {
        lines.push(`_${LABELS.noHintYet}_`, '');
      }
    });
  }

  lines.push('## Catatan Akhir Sesi', '', notes.trim() || '_Tidak ada catatan._', '');
  return lines.join('\n');
}
