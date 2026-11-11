import { COPY } from '@/copy';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
      <section className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)]">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <span className="font-display text-lg font-semibold text-ink-primary">
            {COPY.brand.name}
          </span>
        </div>
        <h1 className="text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-ink-primary">
          {COPY.auth.headline}
        </h1>
        <p className="mt-3 max-w-prose text-ink-secondary">{COPY.brand.tagline}</p>
        <p className="mt-4 tabular-nums text-sm text-ink-muted">25:00</p>
      </section>
    </main>
  );
}
