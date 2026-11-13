'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MatchFallbackOfferEvent, Urgency } from '@syncpod/shared';
import { ArrowRight, Bot, LogOut, Users, X } from 'lucide-react';
import { COPY } from '@/copy';
import { ConnectionBanner, EmptyState } from '@/components/common';
import { PodRing, type PodSeatState } from '@/components/pod-ring';
import {
  MODULE_CATALOG,
  findModuleNodeById,
  getDefaultCustomWindowTimes,
  resolveMatchingWindow,
  type CustomWindowInput,
  type ModuleTreeNode,
  type WindowPreset,
} from '@/features/matchmaking';
import {
  DEMO_CURRENT_USER,
  DEMO_SIMULATED_PEERS,
  FakeRealtimeClient,
  getRealtimeMode,
  getSharedFakeRealtimeClient,
  setFakeSessionAuthenticated,
  type ConnectionState,
  type RealtimeClient,
} from '@/features/realtime';
import { RadioChipGroup, type RadioChipOption } from './Chip';
import { ModulePicker } from './ModulePicker';

export interface MatchmakingShellProps {
  demoModeEnabled: boolean;
  initialClient?: RealtimeClient;
}

const URGENCY_OPTIONS: readonly RadioChipOption<Urgency>[] = [
  { value: 'QUIZ_PREP', label: COPY.matchmaking.urgencyOptions.QUIZ_PREP },
  { value: 'STUCK_ASSIGNMENT', label: COPY.matchmaking.urgencyOptions.STUCK_ASSIGNMENT },
  { value: 'THEORY_REVIEW', label: COPY.matchmaking.urgencyOptions.THEORY_REVIEW },
];

const WINDOW_OPTIONS: readonly RadioChipOption<WindowPreset>[] = [
  { value: 'NOW_25M', label: COPY.matchmaking.windowNow },
  { value: 'NEXT_HOUR', label: COPY.matchmaking.windowNextHour },
  { value: 'CUSTOM', label: COPY.matchmaking.windowCustom },
];

export function MatchmakingShell({ demoModeEnabled, initialClient }: MatchmakingShellProps) {
  const router = useRouter();
  const mode = getRealtimeMode();
  const clientRef = useRef<RealtimeClient | null>(null);

  const [selectedNode, setSelectedNode] = useState<ModuleTreeNode | null>(
    () => findModuleNodeById('mod-dijkstra'),
  );
  const [urgency, setUrgency] = useState<Urgency>('QUIZ_PREP');
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('NOW_25M');
  const [customWindow, setCustomWindow] = useState<CustomWindowInput>(() =>
    getDefaultCustomWindowTimes(Date.now()),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [activePodId, setActivePodId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [seatsCount, setSeatsCount] = useState(0);
  const [fallbackOffer, setFallbackOffer] = useState<MatchFallbackOfferEvent | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isReplyingOffer, setIsReplyingOffer] = useState(false);

  useEffect(() => {
    if (mode !== 'fake' && !initialClient) {
      return;
    }

    const client = initialClient ?? getSharedFakeRealtimeClient();
    clientRef.current = client;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setConnectionState(client.getConnectionState());
      if (client instanceof FakeRealtimeClient) {
        setActivePodId(client.getActivePodId());
      }
    });

    const unsubConn = client.onConnectionStateChange((next) => {
      setConnectionState(next);
    });

    const unsubUpdate = client.on('match:update', (ev) => {
      setSeatsCount(ev.seats);
    });

    const unsubFallback = client.on('match:fallback-offer', (ev) => {
      setFallbackOffer(ev);
      setNowMs(Date.now());
    });

    let matchTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubFound = client.on('match:found', (ev) => {
      setFallbackOffer(null);
      setSeatsCount(4);
      setIsMatched(true);
      matchTimer = setTimeout(() => {
        setIsSearching(false);
        router.push(`/pod/${ev.podId}`);
      }, 600);
    });

    return () => {
      cancelled = true;
      if (matchTimer) clearTimeout(matchTimer);
      unsubConn();
      unsubUpdate();
      unsubFallback();
      unsubFound();
      clientRef.current = null;
    };
  }, [initialClient, mode, router]);

  useEffect(() => {
    if (!fallbackOffer && windowPreset !== 'CUSTOM') {
      return;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (fallbackOffer && current >= fallbackOffer.expiresAt) {
        setFallbackOffer(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fallbackOffer, windowPreset]);

  const windowValidation = useMemo(
    () => resolveMatchingWindow(windowPreset, customWindow, nowMs),
    [windowPreset, customWindow, nowMs],
  );

  const ringSeats: PodSeatState[] = useMemo(() => {
    if ((!isSearching && !isMatched) || seatsCount <= 0) {
      return [1, 2, 3, 4].map((num) => ({ seatNumber: num as 1 | 2 | 3 | 4 }));
    }

    return [1, 2, 3, 4].map((num, idx) => {
      if (num > seatsCount) {
        return { seatNumber: num as 1 | 2 | 3 | 4 };
      }
      if (num === 1) {
        return {
          seatNumber: 1,
          member: {
            userId: DEMO_CURRENT_USER.userId,
            name: DEMO_CURRENT_USER.name,
            role: 'LEADER',
            status: 'IN_FOCUS',
          },
        };
      }
      return {
        seatNumber: num as 1 | 2 | 3 | 4,
        member: DEMO_SIMULATED_PEERS[idx - 1],
      };
    });
  }, [isSearching, isMatched, seatsCount]);

  const fallbackRemainingSec = fallbackOffer
    ? Math.max(0, Math.ceil((fallbackOffer.expiresAt - nowMs) / 1000))
    : 0;

  const isDisconnected = connectionState !== 'connected';
  const canStartSearch =
    Boolean(selectedNode?.isLeaf) &&
    windowValidation.ok &&
    !isSearching &&
    !isDisconnected &&
    activePodId === null;

  async function handleStartSearch(): Promise<void> {
    if (!selectedNode || !selectedNode.isLeaf) {
      setSubmitError(COPY.matchmaking.moduleHintNonLeaf);
      return;
    }

    const currentNow = Date.now();
    setNowMs(currentNow);
    const resolved = resolveMatchingWindow(windowPreset, customWindow, currentNow);
    if (!resolved.ok) {
      setSubmitError(resolved.message);
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    setSubmitError(null);
    setFallbackOffer(null);

    const ack = await client.matchEnqueue({
      moduleId: selectedNode.id,
      urgency,
      windowStart: resolved.windowStart,
      windowEnd: resolved.windowEnd,
    });

    if (!ack.ok) {
      setSubmitError(ack.error.message);
      if (ack.error.code === 'ALREADY_IN_POD' && client instanceof FakeRealtimeClient) {
        setActivePodId(client.getActivePodId());
      }
      return;
    }

    setIsSearching(true);
    setSeatsCount((prev) => (prev > 0 ? prev : 1));
  }

  async function handleCancelSearch(): Promise<void> {
    const client = clientRef.current;
    if (!client) return;
    await client.matchCancel({});
    setIsSearching(false);
    setIsMatched(false);
    setSeatsCount(0);
    setFallbackOffer(null);
    setSubmitError(null);
  }

  function handleFillBots(): void {
    const client = clientRef.current;
    if (client instanceof FakeRealtimeClient) {
      client.fillWithBotsForDemo();
    }
  }

  async function handleFallbackDecision(accept: boolean): Promise<void> {
    const client = clientRef.current;
    if (!client || !fallbackOffer) return;
    setIsReplyingOffer(true);
    try {
      const payload = accept
        ? { offerId: fallbackOffer.offerId, accept: true }
        : { offerId: fallbackOffer.offerId, extend: true as const };
      const ack = await client.matchFallbackReply(payload);
      if (!ack.ok) {
        setSubmitError(ack.error.message);
      }
      setFallbackOffer(null);
    } finally {
      setIsReplyingOffer(false);
    }
  }

  function handleSignOut(): void {
    setFakeSessionAuthenticated(false);
    router.push('/masuk');
  }

  if (mode !== 'fake' && !initialClient) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <EmptyState
          title={COPY.matchmaking.pageTitle}
          message={COPY.matchmaking.realModeNotice}
          actionLabel={COPY.auth.signOut}
          href="/masuk"
        />
      </main>
    );
  }

  const windowSummaryLabel =
    WINDOW_OPTIONS.find((w) => w.value === windowPreset)?.label ?? COPY.matchmaking.windowNow;
  const urgencySummaryLabel = COPY.matchmaking.urgencyOptions[urgency];
  const showDemoFillButton = (demoModeEnabled || mode === 'fake') && isSearching && !fallbackOffer;

  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      <header className="border-b border-border-subtle bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="font-display text-base font-bold text-ink-primary">
              {COPY.brand.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-secondary sm:inline">
              {DEMO_CURRENT_USER.name} · {DEMO_CURRENT_USER.universityName}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-3 py-1.5 text-sm font-medium text-ink-primary transition-all duration-200 hover:border-border-active hover:bg-surface-elevated active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{COPY.auth.signOut}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <ConnectionBanner connectionState={connectionState} className="mb-4" />

        {activePodId && (
          <div
            data-active-pod-banner="true"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border-active bg-surface-elevated px-4 py-3"
          >
            <p className="text-sm font-medium text-ink-primary">
              {COPY.matchmaking.activePodNotice}
            </p>
            <Link
              href={`/pod/${activePodId}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
            >
              <span>{COPY.matchmaking.returnToPod}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        <h1 className="mb-5 font-display text-[clamp(1.5rem,2.8vw,2rem)] font-bold text-ink-primary">
          {COPY.matchmaking.pageTitle}
        </h1>

        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
          {/* Mobile collapsed 1-line summary when searching (< 1280) */}
          {isSearching && (
            <div
              data-mobile-search-summary="true"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border-subtle bg-surface px-4 py-3 xl:hidden"
            >
              <p className="min-w-0 truncate text-sm text-ink-primary">
                <span className="font-medium">{selectedNode?.title}</span>
                <span className="text-ink-muted"> · </span>
                <span className="text-ink-secondary">{urgencySummaryLabel}</span>
                <span className="text-ink-muted"> · </span>
                <span className="text-ink-secondary">{windowSummaryLabel}</span>
              </p>
            </div>
          )}

          {/* Left column: 3-step matchmaking form */}
          <section
            aria-label={COPY.matchmaking.pageTitle}
            className={`${
              isSearching ? 'hidden xl:block' : 'block'
            } rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:p-6`}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                void handleStartSearch();
              }}
              className="space-y-6"
            >
              {/* Step 1: Syllabus module */}
              <div className="space-y-2.5">
                <h2
                  id="matchmaking-module-label"
                  className="font-display text-base font-semibold text-ink-primary"
                >
                  {COPY.matchmaking.modulePrompt}
                </h2>
                <ModulePicker
                  nodes={MODULE_CATALOG}
                  selectedNode={selectedNode}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setSubmitError(null);
                  }}
                  disabled={isSearching || isDisconnected || activePodId !== null}
                />
              </div>

              {/* Step 2: Urgency */}
              <div className="space-y-2.5">
                <h2
                  id="matchmaking-urgency-label"
                  className="font-display text-base font-semibold text-ink-primary"
                >
                  {COPY.matchmaking.urgencyPrompt}
                </h2>
                <RadioChipGroup
                  options={URGENCY_OPTIONS}
                  value={urgency}
                  onChange={setUrgency}
                  labelledBy="matchmaking-urgency-label"
                  disabled={isSearching || isDisconnected || activePodId !== null}
                />
              </div>

              {/* Step 3: Today's window */}
              <div className="space-y-2.5">
                <h2
                  id="matchmaking-window-label"
                  className="font-display text-base font-semibold text-ink-primary"
                >
                  {COPY.matchmaking.windowPrompt}
                </h2>
                <RadioChipGroup
                  options={WINDOW_OPTIONS}
                  value={windowPreset}
                  onChange={(next) => {
                    setWindowPreset(next);
                    if (next === 'CUSTOM') {
                      const current = Date.now();
                      setNowMs(current);
                      setCustomWindow(getDefaultCustomWindowTimes(current));
                    }
                    setSubmitError(null);
                  }}
                  labelledBy="matchmaking-window-label"
                  disabled={isSearching || isDisconnected || activePodId !== null}
                />

                {windowPreset === 'CUSTOM' && (
                  <div className="mt-3 space-y-2 rounded-[var(--radius-control)] border border-border-subtle bg-canvas p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="custom-window-start"
                          className="mb-1 block text-xs font-medium text-ink-secondary"
                        >
                          {COPY.matchmaking.windowStartLabel}
                        </label>
                        <input
                          id="custom-window-start"
                          type="time"
                          disabled={isSearching || isDisconnected}
                          value={customWindow.startHHMM}
                          onChange={(ev) =>
                            setCustomWindow((prev) => ({
                              ...prev,
                              startHHMM: ev.target.value,
                            }))
                          }
                          className="tabular-nums min-h-[44px] w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="custom-window-end"
                          className="mb-1 block text-xs font-medium text-ink-secondary"
                        >
                          {COPY.matchmaking.windowEndLabel}
                        </label>
                        <input
                          id="custom-window-end"
                          type="time"
                          disabled={isSearching || isDisconnected}
                          value={customWindow.endHHMM}
                          onChange={(ev) =>
                            setCustomWindow((prev) => ({
                              ...prev,
                              endHHMM: ev.target.value,
                            }))
                          }
                          className="tabular-nums min-h-[44px] w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-primary focus:border-primary"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-ink-muted">{COPY.matchmaking.windowTodayHelper}</p>

                    {!windowValidation.ok && (
                      <p role="alert" data-window-error="true" className="text-xs font-medium text-danger">
                        {windowValidation.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {submitError && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canStartSearch}
                className={
                  canStartSearch
                    ? 'inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-control)] bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer'
                    : 'inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-control)] border border-border-subtle bg-surface-elevated px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-200 cursor-not-allowed opacity-60'
                }
              >
                {COPY.matchmaking.startMatching}
              </button>
            </form>
          </section>

          {/* Right column: Radar PodRing + match controls / 3-member fallback offer */}
          <aside
            aria-label={COPY.matchmaking.radarIdle}
            className={`${
              isSearching ? 'order-first xl:order-none' : ''
            } flex flex-col items-center rounded-[var(--radius-panel)] border border-border-subtle bg-surface p-[var(--space-card)] md:p-6`}
          >
            {fallbackOffer ? (
              <div
                data-fallback-offer="true"
                className="w-full max-w-sm space-y-4 text-center"
              >
                <div className="opacity-95">
                  <PodRing
                    mode="radar"
                    variant="compact"
                    radarActive={false}
                    seats={ringSeats}
                    progress={0}
                    phase="LOBBY"
                  />
                </div>

                <h2 className="font-display text-lg font-bold text-ink-primary">
                  {COPY.matchmaking.fallbackOffer}
                </h2>
                <p className="tabular-nums text-sm font-medium text-amber">
                  {COPY.matchmaking.fallbackCountdown(fallbackRemainingSec)}
                </p>

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    disabled={isReplyingOffer || isDisconnected}
                    onClick={() => void handleFallbackDecision(true)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {COPY.matchmaking.fallbackAccept}
                  </button>
                  <button
                    type="button"
                    disabled={isReplyingOffer || isDisconnected}
                    onClick={() => void handleFallbackDecision(false)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-4 py-2 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-border-active disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {COPY.matchmaking.fallbackExtend}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <PodRing
                  mode="radar"
                  variant="full"
                  radarActive={isSearching && !isMatched}
                  seats={ringSeats}
                  progress={0}
                  phase="LOBBY"
                  isMatched={isMatched}
                  radarLabel={
                    isMatched
                      ? COPY.matchmaking.matchedSubtitle
                      : isSearching
                        ? COPY.matchmaking.radarFinding(seatsCount)
                        : COPY.matchmaking.radarIdle
                  }
                />

                {isSearching && !isMatched && (
                  <div className="mt-5 flex w-full max-w-xs flex-col gap-2.5">
                    <button
                      type="button"
                      disabled={isDisconnected}
                      onClick={() => void handleCancelSearch()}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border-subtle bg-canvas px-4 py-2 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-danger/60 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>{COPY.matchmaking.cancelMatching}</span>
                    </button>

                    {showDemoFillButton && (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          disabled={isDisconnected}
                          onClick={handleFillBots}
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border-active bg-surface-elevated px-4 py-2 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span>{COPY.matchmaking.demoFillBots}</span>
                          <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-ink-secondary">
                            {COPY.demo.simulatedBadge}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
