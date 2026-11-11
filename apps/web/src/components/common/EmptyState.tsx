import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  actionLabel: string;
  href?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  href,
  onAction,
  className = '',
}: EmptyStateProps) {
  const buttonClass =
    'mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover';

  return (
    <section
      data-empty-state="true"
      className={`rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] ${className}`}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border-subtle bg-canvas text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && <h1 className="font-display text-xl font-bold text-ink-primary">{title}</h1>}
          <p className={`${title ? 'mt-2' : ''} text-sm leading-relaxed text-ink-secondary`}>
            {message}
          </p>
          {href ? (
            <Link href={href} className={buttonClass}>
              {actionLabel}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className={buttonClass}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
