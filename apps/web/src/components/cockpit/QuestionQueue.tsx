'use client';

import { useState, type FormEvent } from 'react';
import type { QuestionDTO } from '@syncpod/shared';
import { CheckCircle2, CircleHelp, MessageSquarePlus, Sparkles } from 'lucide-react';
import { COPY } from '@/copy';

const MAX_QUESTION_CHARS = 280;

export interface QuestionQueueProps {
  questions: readonly QuestionDTO[];
  currentUserId: string;
  leaderId: string;
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
  onAddQuestion: (text: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onResolveQuestion: (questionId: string) => Promise<void>;
  disabled?: boolean;
}

export function QuestionQueue({
  questions,
  currentUserId,
  leaderId,
  selectedQuestionId,
  onSelectQuestion,
  onAddQuestion,
  onResolveQuestion,
  disabled = false,
}: QuestionQueueProps) {
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userHasQuestion = questions.some((q) => q.authorId === currentUserId);
  const trimmedLen = draft.trim().length;
  const charCount = draft.length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled || userHasQuestion || trimmedLen === 0 || charCount > MAX_QUESTION_CHARS) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const result = await onAddQuestion(draft.trim());
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.message);
      return;
    }

    setDraft('');
  }

  async function handleResolve(questionId: string): Promise<void> {
    if (disabled) return;
    setResolvingId(questionId);
    try {
      await onResolveQuestion(questionId);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <section
      aria-label={COPY.cockpit.queueHeading}
      className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircleHelp className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-ink-primary">
            {COPY.cockpit.queueHeading}
          </h2>
        </div>
        <span className="tabular-nums text-xs text-ink-muted">{questions.length}</span>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-border-subtle bg-canvas/40 p-3 text-sm text-ink-secondary">
          {COPY.cockpit.queueEmpty}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {questions.map((question, index) => {
            const isSelected = question.id === selectedQuestionId;
            const canResolve =
              !question.resolved &&
              (question.authorId === currentUserId || leaderId === currentUserId);

            return (
              <li
                key={question.id}
                data-question-id={question.id}
                className={`rounded-[var(--radius-control)] border p-3 transition-colors duration-200 ${
                  isSelected
                    ? 'border-border-active bg-surface-elevated/70'
                    : 'border-border-subtle bg-canvas/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                      <span className="tabular-nums font-medium text-ink-muted">
                        Q{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-medium text-ink-primary">
                        {question.authorName}
                      </span>
                      {question.resolved && (
                        <span className="inline-flex items-center gap-1 rounded bg-surface-elevated px-1.5 py-0.5 text-[0.75rem] font-medium text-emerald">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>{COPY.cockpit.queueResolved}</span>
                        </span>
                      )}
                      {question.aiHint && (
                        <span className="inline-flex items-center gap-1 rounded bg-surface-elevated px-1.5 py-0.5 text-[0.75rem] font-medium text-purple-text">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          <span>{COPY.cockpit.panelGuide}</span>
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1.5 break-words text-sm ${
                        question.resolved
                          ? 'text-ink-muted line-through'
                          : 'text-ink-primary'
                      }`}
                    >
                      {question.text}
                    </p>
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className={`min-h-[36px] rounded-[var(--radius-control)] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                      isSelected
                        ? 'border-purple bg-surface-elevated text-purple-text'
                        : 'border-border-subtle text-ink-secondary hover:border-border-active hover:text-ink-primary'
                    }`}
                  >
                    {isSelected ? COPY.cockpit.queueSelected : COPY.cockpit.queueSelectForGuide}
                  </button>

                  {canResolve && (
                    <button
                      type="button"
                      disabled={disabled || resolvingId === question.id}
                      onClick={() => void handleResolve(question.id)}
                      className="min-h-[36px] rounded-[var(--radius-control)] border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-ink-primary transition-colors duration-200 hover:border-emerald hover:text-emerald disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {COPY.cockpit.queueResolve}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {userHasQuestion ? (
        <p className="mt-3 rounded-[var(--radius-control)] border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink-secondary">
          {COPY.errors.questionLimit}
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-2">
          <div className="space-y-1">
            <label htmlFor="pod-question-input" className="sr-only">
              {COPY.cockpit.queueHeading}
            </label>
            <textarea
              id="pod-question-input"
              rows={2}
              maxLength={MAX_QUESTION_CHARS}
              disabled={disabled || isSubmitting}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={COPY.cockpit.queuePlaceholder}
              className="w-full resize-none rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary disabled:opacity-50"
            />
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="tabular-nums">
                {COPY.cockpit.queueCharCount(charCount, MAX_QUESTION_CHARS)}
              </span>
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-danger">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled || isSubmitting || trimmedLen === 0 || charCount > MAX_QUESTION_CHARS}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border-active bg-surface-elevated px-3 py-2 text-sm font-medium text-ink-primary transition-colors duration-200 hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            <span>{COPY.cockpit.queueSubmit}</span>
          </button>
        </form>
      )}
    </section>
  );
}

