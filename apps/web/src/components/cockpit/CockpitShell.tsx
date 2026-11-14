'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PodSnapshot, TimerAction } from '@syncpod/shared';
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  FileText,
  LogOut,
  PanelRightOpen,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Flag,
  Users,
  X,
} from 'lucide-react';
import { COPY } from '@/copy';
import { ConnectionBanner, CockpitSkeleton, EmptyState, Toast } from '@/components/common';
import { PodRing, type PodSeatState } from '@/components/pod-ring';
import {
  CLOCK_RECALIBRATE_MS,
  CLOCK_SAMPLE_COUNT,
  TIMER_RENDER_INTERVAL_MS,
  TYPING_IDLE_RESET_MS,
  computeClockSample,
  computeCountdownMs,
  computeTimerProgress,
  getRealtimeMode,
  getSharedFakeRealtimeClient,
  selectBestClockSample,
  type ClockSample,
  type ConnectionState,
  type RealtimeClient,
} from '@/features/realtime';
import { CopilotPanel } from './CopilotPanel';
import { MemberRow } from './MemberRow';
import { QuestionQueue } from './QuestionQueue';
import { ScratchpadEditor } from './ScratchpadEditor';

export interface CockpitShellProps {
  podId: string;
  initialClient?: RealtimeClient;
}

type MobileTab = 'notes' | 'queue' | 'guide' | 'pod';

function formatPodCode(podId: string): string {
  const cleaned = podId.replace(/^pod-/i, '');
  return cleaned || podId;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

export function CockpitShell({ podId, initialClient }: CockpitShellProps) {
  const router = useRouter();
  const mode = getRealtimeMode();
  const clientRef = useRef<RealtimeClient | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [snapshot, setSnapshot] = useState<PodSnapshot | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [notes, setNotes] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [askingQuestionId, setAskingQuestionId] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('notes');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasLeftPod, setHasLeftPod] = useState(false);

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
    clientRef.current = client;
    let disposed = false;

    const calibrateClock = async () => {
      const samples: ClockSample[] = [];
      for (let i = 0; i < CLOCK_SAMPLE_COUNT; i += 1) {
        const t0 = Date.now();
        const res = await client.timePing({ t0 });
        const t1 = Date.now();
        if (disposed) return;
        if (res.ok) {
          samples.push(computeClockSample(res.data.t0, res.data.serverNow, t1));
        }
      }
      if (!disposed && samples.length > 0) {
        setOffsetMs(selectBestClockSample(samples).offsetMs);
      }
    };

    const unsubscribeConnection = client.onConnectionStateChange((nextState) => {
      setConnectionState(nextState);
    });

    const unsubscribePod = client.on('pod:state', (nextSnapshot) => {
      if (nextSnapshot.podId === podId) {
        setSnapshot(nextSnapshot);
        setNowMs(Date.now());
      }
    });

    const unsubscribePresence = client.on('presence:update', ({ userId, status }) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) => (m.userId === userId ? { ...m, status } : m)),
        };
      });
    });

    const unsubscribeQueue = client.on('queue:update', ({ questions }) => {
      setSnapshot((prev) => (prev ? { ...prev, questions } : prev));
    });

    const unsubscribeSocraticResult = client.on('socratic:result', ({ questionId, hint }) => {
      setAskingQuestionId((current) => (current === questionId ? null : current));
      setGuideError(null);
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId ? { ...q, aiHint: hint } : q,
          ),
        };
      });
    });

    const unsubscribeSocraticError = client.on('socratic:error', ({ questionId }) => {
      setAskingQuestionId((current) => (current === questionId ? null : current));
      setGuideError(COPY.errors.guideUnavailable);
    });

    const unsubscribeNotes = client.subscribeNotes(podId, (nextNotes) => {
      setNotes(nextNotes);
    });

    const bootstrap = async () => {
      setConnectionState(client.getConnectionState());
      const joinAck = await client.podJoin({ podId });
      if (disposed) return;
      if (!joinAck.ok) {
        setNotFound(true);
        return;
      }
      setCurrentUserId(client.getCurrentUserId());
      setSnapshot(joinAck.data);
      setNotes(client.getNotes(podId));
      setNowMs(Date.now());
      if (joinAck.data.questions[0]) {
        setSelectedQuestionId(joinAck.data.questions[0].id);
      }
      await calibrateClock();
    };

    void bootstrap();

    const recalibrateTimer = setInterval(() => {
      void calibrateClock();
    }, CLOCK_RECALIBRATE_MS);

    return () => {
      disposed = true;
      clearInterval(recalibrateTimer);
      if (typingTimerRef.current !== null) {
        clearTimeout(typingTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
      unsubscribeConnection();
      unsubscribePod();
      unsubscribePresence();
      unsubscribeQueue();
      unsubscribeSocraticResult();
      unsubscribeSocraticError();
      unsubscribeNotes();
      clientRef.current = null;
    };
  }, [initialClient, mode, podId]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.pausedRemainingMs !== null) return;
    if (snapshot.phase !== 'FOCUS' && snapshot.phase !== 'BREAK') return;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, TIMER_RENDER_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [snapshot]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    queueMicrotask(() => {
      drawerTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const drawerEl = drawerRef.current;
    if (!drawerEl) return;

    const focusables = getFocusableElements(drawerEl);
    const initialTarget = focusables[0];
    if (initialTarget) {
      initialTarget.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusableElements(drawerEl);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const handleViewportChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) {
        setIsDrawerOpen(false);
      }
    };
    mediaQuery.addEventListener('change', handleViewportChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen, closeDrawer]);

  const isLeader = snapshot?.leaderId === currentUserId;
  const isPaused = snapshot?.pausedRemainingMs !== null;
  const isDisconnected = connectionState !== 'connected';

  const remainingMs = useMemo(() => {
    if (!snapshot) return 0;
    return computeCountdownMs({
      phase: snapshot.phase,
      phaseEndsAt: snapshot.phaseEndsAt,
      pausedRemainingMs: snapshot.pausedRemainingMs,
      localNowMs: nowMs,
      offsetMs,
    });
  }, [snapshot, nowMs, offsetMs]);

  const progress = useMemo(() => {
    if (!snapshot) return 0;
    return computeTimerProgress(remainingMs, snapshot.phaseDurationSec, snapshot.phase);
  }, [snapshot, remainingMs]);

  const ringSeats: PodSeatState[] = useMemo(() => {
    if (!snapshot) return [];
    return [1, 2, 3, 4].map((num, idx) => ({
      seatNumber: num as 1 | 2 | 3 | 4,
      member: snapshot.members[idx],
    }));
  }, [snapshot]);

  const selectedQuestion = useMemo(() => {
    if (!snapshot || snapshot.questions.length === 0) return null;
    if (selectedQuestionId) {
      const matched = snapshot.questions.find((q) => q.id === selectedQuestionId);
      if (matched) return matched;
    }
    return snapshot.questions.find((q) => !q.resolved) ?? snapshot.questions[0] ?? null;
  }, [snapshot, selectedQuestionId]);

  const handleNotesChange = useCallback(
    (nextContent: string) => {
      setNotes(nextContent);
      clientRef.current?.updateNotes(podId, nextContent);
    },
    [podId],
  );

  const handleTypingActivity = useCallback(() => {
    const client = clientRef.current;
    if (!client || hasLeftPod || connectionState !== 'connected') return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void client.presenceSet({ podId, status: 'TAKING_NOTES' });
    }

    if (typingTimerRef.current !== null) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      typingTimerRef.current = null;
      void client.presenceSet({ podId, status: 'IN_FOCUS' });
    }, TYPING_IDLE_RESET_MS);
  }, [connectionState, hasLeftPod, podId]);

  async function handleStartPod(): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    setActionError(null);
    const ack = await client.podStart({ podId });
    if (!ack.ok) {
      setActionError(ack.error.message || COPY.errors.genericActionFailed);
    }
  }

  async function handleTimerAction(action: TimerAction): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    setActionError(null);
    const ack = await client.timerControl({ podId, action });
    if (!ack.ok) {
      setActionError(ack.error.message || COPY.errors.genericActionFailed);
      return;
    }
    if (action === 'END' && !initialClient) {
      router.push(`/pod/${podId}/selesai`);
    }
  }

  async function handleLeavePod(): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    const ack = await client.podLeave({ podId });
    if (ack.ok) {
      setHasLeftPod(true);
      if (!initialClient) {
        router.push('/pod');
      }
    }
  }

  async function handleRejoinPod(): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    const ack = await client.podJoin({ podId });
    if (ack.ok) {
      setHasLeftPod(false);
    }
  }

  async function handleAddQuestion(
    text: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const client = clientRef.current;
    if (!client || isDisconnected) {
      return { ok: false, message: COPY.errors.disconnected };
    }
    const ack = await client.queueAdd({ podId, text });
    if (!ack.ok) {
      return { ok: false, message: ack.error.message };
    }
    setSelectedQuestionId(ack.data.id);
    showToast(COPY.cockpit.queueAddedToast);
    return { ok: true };
  }

  async function handleResolveQuestion(questionId: string): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    await client.queueResolve({ podId, questionId });
  }

  async function handleAskGuide(questionId: string): Promise<void> {
    const client = clientRef.current;
    if (!client || isDisconnected) return;
    setGuideError(null);
    setAskingQuestionId(questionId);
    const ack = await client.socraticAsk({ podId, questionId });
    if (!ack.ok) {
      setAskingQuestionId(null);
      setGuideError(ack.error.message || COPY.errors.guideUnavailable);
    }
  }

  if (mode !== 'fake' && !initialClient) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <EmptyState
          title={COPY.cockpit.podLabel(formatPodCode(podId))}
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
          actionLabel={COPY.matchmaking.startMatching}
          href="/pod"
        />
      </main>
    );
  }

  if (!snapshot) {
    return <CockpitSkeleton />;
  }

  const controlsDisabled = hasLeftPod || snapshot.phase === 'COMPLETED' || isDisconnected;
  const showLeaderControls = isLeader && snapshot.phase !== 'COMPLETED' && !hasLeftPod;

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink-primary xl:h-[100dvh] xl:overflow-hidden">
      {/* Single responsive header (single <h1> across 375, 768, 1280) + mobile sticky mini ring */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-border-subtle bg-surface md:static md:bg-surface/80">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-2.5 md:px-5 md:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden font-display text-base font-bold text-primary md:inline">
              {COPY.brand.name}
            </span>
            <span className="hidden text-ink-muted md:inline" aria-hidden="true">
              /
            </span>
            <h1 className="truncate font-display text-xs font-semibold text-ink-primary md:text-base">
              {snapshot.module.title} · {COPY.cockpit.podLabel(formatPodCode(snapshot.podId))}
            </h1>
          </div>

          <div className="hidden shrink-0 items-center gap-2.5 md:flex">
            <button
              ref={drawerTriggerRef}
              type="button"
              aria-expanded={isDrawerOpen}
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-control)] border border-border-active bg-surface-elevated px-3 py-1.5 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-primary xl:hidden"
            >
              <PanelRightOpen className="h-4 w-4 text-purple-text" aria-hidden="true" />
              <span>{COPY.cockpit.openSidePanel}</span>
            </button>

            {hasLeftPod ? (
              <button
                type="button"
                disabled={isDisconnected}
                onClick={() => void handleRejoinPod()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{COPY.cockpit.rejoinPod}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isDisconnected}
                onClick={() => void handleLeavePod()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-3 py-1.5 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:border-danger/60 hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{COPY.cockpit.leavePod}</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-border-subtle md:hidden">
          <PodRing
            mode="timer"
            variant="mini"
            announcePhase={false}
            seats={ringSeats}
            progress={progress}
            phase={snapshot.phase}
            round={snapshot.round}
            remainingMs={remainingMs}
            isPaused={isPaused}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 min-h-0 flex-col px-3 pb-24 pt-3 md:px-5 md:pb-6 md:pt-4 xl:pb-4 xl:pt-3">
        <ConnectionBanner connectionState={connectionState} className="mb-3 shrink-0" />

        {snapshot.phase === 'COMPLETED' && (
          <div
            data-sprint-completed-banner="true"
            className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-emerald/50 bg-surface-elevated px-4 py-3"
          >
            <div className="flex items-center gap-2 text-emerald">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-ink-primary">
                {COPY.cockpit.timer.completedPhase}
              </span>
            </div>
            <Link
              href={`/pod/${podId}/selesai`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
            >
              <span>{COPY.cockpit.viewSummary}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {toastMessage && <Toast message={toastMessage} className="mb-3 shrink-0" />}

        <div className="flex flex-col gap-[var(--space-gap)] xl:grid xl:flex-1 xl:min-h-0 xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:items-stretch">
          {/* Left Panel (Desktop column 1 / Tablet horizontal top bar / Mobile Pod tab) */}
          <aside
            aria-label={COPY.cockpit.panelPod}
            className={`${
              mobileTab === 'pod' ? 'flex' : 'hidden'
            } min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:flex md:flex-row md:items-center md:justify-between xl:flex-col xl:items-stretch xl:justify-between xl:h-full xl:overflow-y-auto`}
          >
            <div className="flex flex-col items-center gap-3 md:flex-row md:items-center xl:flex-col">
              <div className="md:hidden xl:block">
                <PodRing
                  mode="timer"
                  variant="full"
                  announcePhase={true}
                  seats={ringSeats}
                  progress={progress}
                  phase={snapshot.phase}
                  round={snapshot.round}
                  remainingMs={remainingMs}
                  isPaused={isPaused}
                />
              </div>
              <div className="hidden md:block xl:hidden">
                <PodRing
                  mode="timer"
                  variant="compact"
                  announcePhase={false}
                  seats={ringSeats}
                  progress={progress}
                  phase={snapshot.phase}
                  round={snapshot.round}
                  remainingMs={remainingMs}
                  isPaused={isPaused}
                />
              </div>

              {showLeaderControls && (
                <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:flex-col md:items-stretch xl:w-full xl:flex-row xl:justify-center">
                  {snapshot.phase === 'LOBBY' ? (
                    <button
                      type="button"
                      disabled={isDisconnected}
                      onClick={() => void handleStartPod()}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>{COPY.cockpit.timer.start}</span>
                    </button>
                  ) : (
                    <div className="flex w-full flex-col gap-2">
                      {/* Jeda / Lanjut: PRIMARY */}
                      <button
                        type="button"
                        disabled={isDisconnected}
                        onClick={() => void handleTimerAction(isPaused ? 'RESUME' : 'PAUSE')}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPaused ? (
                          <Play className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Pause className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>
                          {isPaused ? COPY.cockpit.timer.resume : COPY.cockpit.timer.pause}
                        </span>
                      </button>

                      <div className="grid w-full grid-cols-2 gap-2">
                        {/* Lewati: SECONDARY */}
                        <button
                          type="button"
                          disabled={isDisconnected}
                          onClick={() => void handleTimerAction('SKIP')}
                          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-surface px-2.5 py-2 text-xs font-medium text-ink-primary transition-all duration-200 hover:border-border-active hover:bg-surface-elevated active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <SkipForward className="h-3.5 w-3.5 text-ink-secondary" aria-hidden="true" />
                          <span>{COPY.cockpit.timer.skip}</span>
                        </button>

                        {/* Akhiri sprint: QUIET DANGER */}
                        <button
                          type="button"
                          disabled={isDisconnected}
                          onClick={() => void handleTimerAction('END')}
                          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle/80 bg-canvas px-2.5 py-2 text-xs font-medium text-ink-muted transition-all duration-200 hover:border-danger/60 hover:text-danger active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-danger focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{COPY.cockpit.timer.end}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isLeader && snapshot.phase !== 'COMPLETED' && (
                <p className="text-center text-xs text-ink-muted">{COPY.cockpit.leaderOnlyHint}</p>
              )}

              {actionError && (
                <p role="alert" className="text-center text-xs text-danger">
                  {actionError}
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1 border-t border-border-subtle pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-ink-primary">
                  {COPY.cockpit.membersHeading}
                </h2>
                <span className="tabular-nums text-xs text-ink-muted">
                  {snapshot.members.length}/4
                </span>
              </div>

              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 xl:grid-cols-1">
                {snapshot.members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    isCurrentUser={member.userId === currentUserId}
                  />
                ))}
              </ul>

              <div className="mt-3 md:hidden">
                {hasLeftPod ? (
                  <button
                    type="button"
                    disabled={isDisconnected}
                    onClick={() => void handleRejoinPod()}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{COPY.cockpit.rejoinPod}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isDisconnected}
                    onClick={() => void handleLeavePod()}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-3 py-2 text-sm font-medium text-ink-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>{COPY.cockpit.leavePod}</span>
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Center Panel: Scratchpad Editor */}
          <div className={`${mobileTab === 'notes' ? 'flex' : 'hidden'} min-w-0 flex-1 md:flex xl:h-full xl:min-h-0`}>
            <ScratchpadEditor
              value={notes}
              onChange={handleNotesChange}
              onTypingActivity={handleTypingActivity}
              readOnly={controlsDisabled}
            />
          </div>

          {/* Tablet Drawer Backdrop */}
          {isDrawerOpen && (
            <div
              aria-hidden="true"
              onClick={closeDrawer}
              className="fixed inset-0 z-40 hidden bg-canvas/75 md:block xl:hidden"
            />
          )}

          {/* Right Panel */}
          <aside
            ref={drawerRef}
            role={isDrawerOpen ? 'dialog' : undefined}
            aria-modal={isDrawerOpen ? true : undefined}
            aria-label={COPY.cockpit.openSidePanel}
            className={`${
              mobileTab === 'queue' || mobileTab === 'guide'
                ? 'flex min-w-0 flex-col gap-[var(--space-gap)]'
                : isDrawerOpen
                  ? 'fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-[var(--space-gap)] overflow-y-auto border-l border-border-subtle bg-canvas p-4 shadow-2xl xl:static xl:z-auto xl:w-auto xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none'
                  : 'hidden xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-[var(--space-gap)] xl:overflow-y-auto'
            }`}
          >
            {isDrawerOpen && (
              <div className="flex items-center justify-between border-b border-border-subtle pb-2 xl:hidden">
                <span className="font-display text-sm font-semibold text-ink-primary">
                  {COPY.cockpit.openSidePanel}
                </span>
                <button
                  type="button"
                  aria-label={COPY.cockpit.closeDrawer}
                  onClick={closeDrawer}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] border border-border-subtle bg-surface text-ink-primary transition-all duration-200 hover:border-border-active hover:bg-surface-elevated active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className={mobileTab === 'queue' ? 'hidden md:block' : 'block'}>
              <CopilotPanel
                question={selectedQuestion}
                isLoading={askingQuestionId !== null && askingQuestionId === selectedQuestion?.id}
                errorMessage={guideError}
                onAskGuide={handleAskGuide}
                disabled={controlsDisabled}
              />
            </div>

            <div className={mobileTab === 'guide' ? 'hidden md:block' : 'block'}>
              <QuestionQueue
                questions={snapshot.questions}
                currentUserId={currentUserId}
                leaderId={snapshot.leaderId}
                selectedQuestionId={selectedQuestion?.id ?? null}
                onSelectQuestion={(id) => {
                  setSelectedQuestionId(id);
                  setGuideError(null);
                }}
                onAddQuestion={handleAddQuestion}
                onResolveQuestion={handleResolveQuestion}
                disabled={controlsDisabled}
              />
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile bottom tab bar (< 768px), touch target ≥ 44px */}
      <nav
        aria-label={COPY.brand.name}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border-subtle bg-surface md:hidden"
      >
        <button
          type="button"
          onClick={() => setMobileTab('notes')}
          aria-current={mobileTab === 'notes' ? 'page' : undefined}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium ${
            mobileTab === 'notes' ? 'text-primary' : 'text-ink-secondary'
          }`}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>{COPY.cockpit.tabNotes}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('queue')}
          aria-current={mobileTab === 'queue' ? 'page' : undefined}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium ${
            mobileTab === 'queue' ? 'text-primary' : 'text-ink-secondary'
          }`}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          <span>{COPY.cockpit.tabQueue}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('guide')}
          aria-current={mobileTab === 'guide' ? 'page' : undefined}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium ${
            mobileTab === 'guide' ? 'text-purple-text' : 'text-ink-secondary'
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{COPY.cockpit.tabGuide}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('pod')}
          aria-current={mobileTab === 'pod' ? 'page' : undefined}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium ${
            mobileTab === 'pod' ? 'text-primary' : 'text-ink-secondary'
          }`}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{COPY.cockpit.tabPod}</span>
        </button>
      </nav>
    </div>
  );
}
