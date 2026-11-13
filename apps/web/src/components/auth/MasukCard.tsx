'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, UserCheck, Users } from 'lucide-react';
import { COPY } from '@/copy';
import { PodRing } from '@/components/pod-ring';
import { getRealtimeMode, setFakeSessionAuthenticated } from '@/features/realtime';

export interface MasukCardProps {
  demoModeEnabled: boolean;
  initialError?: string | null;
}

const IDLE_SEATS = [
  { seatNumber: 1 as const },
  { seatNumber: 2 as const },
  { seatNumber: 3 as const },
  { seatNumber: 4 as const },
];

export function MasukCard({ demoModeEnabled, initialError = null }: MasukCardProps) {
  const router = useRouter();
  const mode = getRealtimeMode();
  const showDemoLogin = demoModeEnabled || mode === 'fake';
  const [noticeMessage, setNoticeMessage] = useState<string | null>(initialError);
  const [isNavigating, setIsNavigating] = useState(false);

  function handleSignIn(): void {
    if (mode === 'fake') {
      setIsNavigating(true);
      setFakeSessionAuthenticated(true);
      router.push('/pod');
      return;
    }
    setNoticeMessage(COPY.auth.realModeNotice);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div
        data-idle-pod-ring="true"
        className="mb-5 flex flex-col items-center justify-center text-center"
      >
        <PodRing
          mode="radar"
          variant="compact"
          radarActive={false}
          seats={IDLE_SEATS}
          progress={0}
          phase="LOBBY"
        />
        <p
          data-prototype-notice="true"
          className="mt-2.5 text-xs font-medium text-ink-muted"
        >
          {COPY.auth.prototypeNotice}
        </p>
      </div>

      <section className="rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-6 md:p-7">
        <div className="flex items-center gap-2.5 text-primary">
          <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-display text-lg font-bold text-ink-primary">
            {COPY.brand.name}
          </span>
        </div>

        <h1 className="mt-5 font-display text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-ink-primary">
          {COPY.auth.headline}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-secondary">
          {COPY.brand.tagline}
        </p>

        {noticeMessage && (
          <p
            role="alert"
            className="mt-4 rounded-[var(--radius-control)] border border-amber/50 bg-canvas px-3.5 py-2.5 text-sm text-ink-primary"
          >
            {noticeMessage}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={isNavigating}
            onClick={handleSignIn}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{COPY.auth.signInGoogle}</span>
          </button>

          {showDemoLogin && (
            <div className="pt-1 text-center">
              <button
                type="button"
                disabled={isNavigating}
                onClick={handleSignIn}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-4 py-2 text-sm font-medium text-ink-primary transition-all duration-200 hover:border-border-active hover:bg-surface-elevated active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{COPY.auth.signInDemo}</span>
              </button>
              <p className="mt-2 text-xs text-ink-muted">{COPY.auth.demoNote}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
