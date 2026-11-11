import { WifiOff } from 'lucide-react';
import { COPY } from '@/copy';
import type { ConnectionState } from '@/features/realtime';

export interface ConnectionBannerProps {
  connectionState: ConnectionState;
  className?: string;
}

export function ConnectionBanner({ connectionState, className = '' }: ConnectionBannerProps) {
  if (connectionState === 'connected') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-connection-banner="true"
      data-connection-state={connectionState}
      className={`flex items-center gap-2.5 rounded-[var(--radius-control)] border border-amber/60 bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-ink-primary ${className}`}
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
      <span>{COPY.errors.disconnected}</span>
    </div>
  );
}
