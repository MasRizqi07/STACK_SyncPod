'use client';

import type { QuestionDTO } from '@syncpod/shared';
import { BookOpen, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { COPY } from '@/copy';
import { MarkdownPreview } from './MarkdownPreview';

export interface CopilotPanelProps {
  question: QuestionDTO | null;
  isLoading: boolean;
  errorMessage: string | null;
  onAskGuide: (questionId: string) => Promise<void>;
  disabled?: boolean;
}

export function CopilotPanel({
  question,
  isLoading,
  errorMessage,
  onAskGuide,
  disabled = false,
}: CopilotPanelProps) {
  const hint = question?.aiHint ?? null;

  return (
    <section
      aria-label={COPY.cockpit.panelGuide}
      className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-purple/50 bg-surface p-[var(--space-card)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-ink-primary">
            {COPY.cockpit.panelGuide}
          </h2>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-secondary">{COPY.cockpit.guideIntro}</p>

      {question ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-[var(--radius-control)] border border-border-subtle bg-canvas/60 p-3">
            <p className="text-xs font-medium text-ink-secondary">{question.authorName}</p>
            <p className="mt-1 break-words text-sm text-ink-primary">
              &ldquo;{question.text}&rdquo;
            </p>
          </div>

          {!hint && (
            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() => void onAskGuide(question.id)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-purple bg-purple px-3 py-2 text-sm font-semibold text-canvas transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isLoading ? COPY.cockpit.guideLoading : COPY.cockpit.guideAsk}</span>
            </button>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-danger/40 bg-canvas px-3 py-2 text-xs text-danger"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                disabled={disabled || isLoading}
                onClick={() => void onAskGuide(question.id)}
                className="inline-flex shrink-0 items-center gap-1 font-medium text-ink-primary underline-offset-2 hover:underline"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>{COPY.cockpit.retryAction}</span>
              </button>
            </div>
          )}

          {hint && (
            <div
              data-socratic-hint="true"
              className="space-y-3 rounded-[var(--radius-control)] border border-purple/40 bg-canvas/70 p-3"
            >
              <div>
                <p className="text-xs font-semibold text-purple-text">
                  {COPY.cockpit.guideConceptLabel}
                </p>
                <div className="mt-1 text-sm text-ink-primary">
                  <MarkdownPreview content={hint.concept} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-purple-text">
                  {COPY.cockpit.guideQuestionsLabel}
                </p>
                <ol className="mt-1.5 list-decimal space-y-1.5 pl-4 text-sm text-ink-primary">
                  {hint.guidingQuestions.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="text-xs font-semibold text-purple-text">
                  {COPY.cockpit.guideAnalogyLabel}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{hint.analogy}</p>
              </div>

              {hint.docHint && (
                <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-text">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{COPY.cockpit.guideDocHintLabel}</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-ink-primary">{hint.docHint.source}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-secondary">
                    {hint.docHint.searchFor}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-[var(--radius-control)] border border-dashed border-border-subtle bg-canvas/40 p-3 text-xs text-ink-muted">
          {COPY.cockpit.guideSelectHint}
        </p>
      )}

      <p className="mt-3 border-t border-border-subtle pt-2.5 text-xs text-ink-muted">
        {COPY.cockpit.guidePrivacy}
      </p>
    </section>
  );
}

