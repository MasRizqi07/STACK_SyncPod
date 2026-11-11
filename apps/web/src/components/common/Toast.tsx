import { Check, Info } from 'lucide-react';

export interface ToastProps {
  message: string | null;
  tone?: 'success' | 'info';
  className?: string;
}

export function Toast({ message, tone = 'success', className = '' }: ToastProps) {
  if (!message) {
    return null;
  }

  const isSuccess = tone === 'success';
  const Icon = isSuccess ? Check : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      data-toast="true"
      className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] border px-3.5 py-2 text-xs font-medium ${
        isSuccess
          ? 'border-emerald/50 bg-surface-elevated text-emerald'
          : 'border-border-active bg-surface-elevated text-primary'
      } ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-ink-primary">{message}</span>
    </div>
  );
}
