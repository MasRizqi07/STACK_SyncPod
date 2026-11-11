import { COPY } from '@/copy';

export interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`syncpod-skeleton-pulse rounded-[var(--radius-control)] border border-border-subtle bg-surface-elevated ${className}`}
    />
  );
}

export function CockpitSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label={COPY.common.loadingLabel}
      data-skeleton="cockpit"
      className="mx-auto min-h-screen max-w-[1440px] px-3 py-3 md:px-5 md:py-4"
    >
      <span className="sr-only">{COPY.common.loadingLabel}</span>
      <SkeletonBlock className="mb-4 h-14 w-full rounded-[var(--radius-panel)]" />
      <div className="flex flex-col gap-[var(--space-gap)] xl:grid xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
          <div className="mx-auto h-52 w-52 rounded-full border border-border-subtle bg-surface-elevated syncpod-skeleton-pulse" />
          <div className="mt-5 space-y-2.5">
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
          </div>
        </div>
        <div className="min-h-[380px] rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
          <SkeletonBlock className="mb-4 h-9 w-48" />
          <SkeletonBlock className="h-72 w-full" />
        </div>
        <div className="hidden space-y-4 xl:block">
          <div className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
            <SkeletonBlock className="mb-3 h-5 w-28" />
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="mt-3 h-11 w-full" />
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
            <SkeletonBlock className="mb-3 h-5 w-36" />
            <SkeletonBlock className="h-28 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function SummarySkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label={COPY.common.loadingLabel}
      data-skeleton="summary"
      className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:px-6"
    >
      <span className="sr-only">{COPY.common.loadingLabel}</span>
      <SkeletonBlock className="mb-6 h-12 w-full rounded-[var(--radius-panel)]" />
      <div className="space-y-4">
        <div className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
          <SkeletonBlock className="h-8 w-52" />
          <SkeletonBlock className="mt-3 h-4 w-72" />
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="mt-3 h-32 w-full" />
        </div>
      </div>
    </main>
  );
}
