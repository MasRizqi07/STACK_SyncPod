'use client';

import { COPY } from '@/copy';

interface PodErrorProps {
  reset: () => void;
}

export default function PodError({ reset }: PodErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <section className="rounded-[var(--radius-panel)] border border-danger/40 bg-surface p-[var(--space-card)]">
        <h1 className="font-display text-xl font-bold text-ink-primary">
          {COPY.cockpit.errorBoundaryTitle}
        </h1>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
        >
          {COPY.cockpit.errorBoundaryRetry}
        </button>
      </section>
    </main>
  );
}

