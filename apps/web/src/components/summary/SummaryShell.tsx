'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PodSnapshot } from '@syncpod/shared';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Sparkles,
  Users,
} from 'lucide-react';
import { COPY } from '@/copy';
import { ConnectionBanner, EmptyState, SummarySkeleton, Toast } from '@/components/common';
import { MarkdownPreview } from '@/components/cockpit';
import {
  getRealtimeMode,
  getSharedFakeRealtimeClient,
  type ConnectionState,
  type RealtimeClient,
} from '@/features/realtime';
import {
  buildSummaryMarkdown,
  formatDurationClock,
  formatSummaryDate,
} from '@/features/summary';

export interface SummaryShellProps {
  podId: string;
  initialClient?: RealtimeClient;
}

export function SummaryShell({ podId, initialClient }: SummaryShellProps) {
  const mode = getRealtimeMode();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [snapshot, setSnapshot] = useState<PodSnapshot | null>(null);
  const [notes, setNotes] = useState('');
  const [completedAtMs, setCompletedAtMs] = useState(() => Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [notFound, setNotFound] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    if (mode !== 'fake' && !initialClient) {
      return;
    }

    const client = initialClient ?? getSharedFakeRealtimeClient();
    let disposed = false;

    const unsubConn = client.onConnectionStateChange((next) => {
      setConnectionState(next);
    });

    const loadSummary = async () => {
      setConnectionState(client.getConnectionState());
      const ack = await client.podJoin({ podId });
      if (disposed) return;
      if (!ack.ok) {
        setNotFound(true);
        return;
      }
      setSnapshot(ack.data);
      setNotes(client.getNotes(podId));
      setCompletedAtMs(ack.data.serverNow || Date.now());
    };

    void loadSummary();

    return () => {
      disposed = true;
      unsubConn();
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [initialClient, mode, podId]);

  function handleDownloadMarkdown(): void {
    if (!snapshot) return;
    const markdown = buildSummaryMarkdown({ snapshot, notes, completedAtMs });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `syncpod-${snapshot.podId}-ringkasan.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(COPY.summary.downloadedToast);
  }

  if (mode !== 'fake' && !initialClient) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <EmptyState
          title={COPY.summary.title}
          message={COPY.cockpit.realModeUnavailable}
          actionLabel={COPY.auth.signInGoogle}
          href="/masuk"
        />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <EmptyState
          title={COPY.cockpit.podNotFoundTitle}
          message={COPY.cockpit.podNotFoundBody}
          actionLabel={COPY.summary.backToMatchmaking}
          href="/pod"
        />
      </main>
    );
  }

  if (!snapshot) {
    return <SummarySkeleton />;
  }

  const resolvedCount = snapshot.questions.filter((q) => q.resolved).length;

  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      <header className="border-b border-border-subtle bg-surface/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-display text-base font-bold text-ink-primary">
              {COPY.brand.name}
            </span>
            <span className="text-ink-muted" aria-hidden="true">
              /
            </span>
            <span className="truncate text-sm text-ink-secondary">{snapshot.module.title}</span>
          </div>

          <Link
            href="/pod"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-3 py-1.5 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:border-border-active hover:text-ink-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{COPY.summary.backToMatchmaking}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-6 md:py-8">
        <ConnectionBanner connectionState={connectionState} />
        {toastMessage && <Toast message={toastMessage} />}

        <section className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{snapshot.module.path.join(' › ')}</span>
              </div>
              <h1 className="font-display text-[clamp(1.625rem,3vw,2.125rem)] font-bold text-ink-primary">
                {COPY.summary.title}
              </h1>
              <p className="text-sm text-ink-secondary">
                {COPY.summary.dateLabel}: {formatSummaryDate(completedAtMs)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{COPY.summary.downloadMarkdown}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-[var(--radius-control)] border border-border-subtle bg-canvas/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-display text-sm font-semibold text-ink-primary">
                  {COPY.summary.statsHeading}
                </h2>
              </div>

              <ul className="m-0 list-none space-y-2 p-0">
                {snapshot.members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-primary">{member.name}</span>
                      {member.isSimulated && (
                        <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs font-medium text-ink-secondary">
                          {COPY.demo.simulatedBadge}
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums text-sm font-semibold text-primary">
                      {formatDurationClock(member.focusedSec ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-between rounded-[var(--radius-control)] border border-border-subtle bg-canvas/50 p-4">
              <h2 className="font-display text-sm font-semibold text-ink-primary">
                {COPY.summary.resolvedCountLabel}
              </h2>
              <p className="mt-3 tabular-nums text-3xl font-bold text-emerald">
                {resolvedCount}/{snapshot.questions.length}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {COPY.cockpit.podLabel(snapshot.podId.replace(/^pod-/i, '') || snapshot.podId)}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label={COPY.summary.questionsHeading}
          className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-ink-primary">
              {COPY.summary.questionsHeading}
            </h2>
          </div>

          {snapshot.questions.length === 0 ? (
            <p className="text-sm text-ink-secondary">{COPY.summary.questionsEmpty}</p>
          ) : (
            <ul className="m-0 list-none space-y-4 p-0">
              {snapshot.questions.map((question, index) => (
                <li
                  key={question.id}
                  className="rounded-[var(--radius-control)] border border-border-subtle bg-canvas/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                    <span className="font-medium text-ink-primary">
                      Q{index + 1} · {question.authorName}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-medium ${
                        question.resolved
                          ? 'bg-surface-elevated text-emerald'
                          : 'bg-surface-elevated text-ink-muted'
                      }`}
                    >
                      {question.resolved ? COPY.cockpit.queueResolved : COPY.summary.unresolvedTag}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-ink-primary">{question.text}</p>

                  {question.aiHint ? (
                    <div className="mt-3 space-y-2.5 rounded-[var(--radius-control)] border border-purple/40 bg-surface p-3">
                      <div>
                        <p className="text-xs font-semibold text-purple-text">
                          {COPY.cockpit.guideConceptLabel}
                        </p>
                        <div className="mt-1 text-sm text-ink-primary">
                          <MarkdownPreview content={question.aiHint.concept} />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-purple-text">
                          {COPY.cockpit.guideQuestionsLabel}
                        </p>
                        <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-ink-primary">
                          {question.aiHint.guidingQuestions.map((item, qIdx) => (
                            <li key={qIdx}>{item}</li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-purple-text">
                          {COPY.cockpit.guideAnalogyLabel}
                        </p>
                        <p className="mt-1 text-sm text-ink-secondary">{question.aiHint.analogy}</p>
                      </div>

                      {question.aiHint.docHint && (
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                          <BookOpen className="h-3.5 w-3.5 text-purple-text" aria-hidden="true" />
                          <span className="font-medium text-ink-primary">
                            {question.aiHint.docHint.source}:
                          </span>
                          <span className="font-mono">{question.aiHint.docHint.searchFor}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted">{COPY.summary.noHintYet}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label={COPY.summary.notesHeading}
          className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:p-6"
        >
          <h2 className="mb-3 font-display text-base font-semibold text-ink-primary">
            {COPY.summary.notesHeading}
          </h2>
          <MarkdownPreview content={notes} />
        </section>
      </main>
    </div>
  );
}
