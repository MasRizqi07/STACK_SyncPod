import type { PodPhase } from '@syncpod/shared';

export const CLOCK_SAMPLE_COUNT = 5;
export const CLOCK_RECALIBRATE_MS = 60_000;
export const TIMER_RENDER_INTERVAL_MS = 250;
export const LAST_MINUTE_THRESHOLD_MS = 60_000;

export interface ClockSample {
  t0: number;
  serverNow: number;
  t1: number;
  rtt: number;
  offsetMs: number;
}

/**
 * Computes round-trip time and clock offset using DESIGN B6:
 * offset = serverNow - (t0 + rtt / 2).
 */
export function computeClockSample(t0: number, serverNow: number, t1: number): ClockSample {
  const rtt = Math.max(0, t1 - t0);
  const offsetMs = serverNow - (t0 + rtt / 2);
  return { t0, serverNow, t1, rtt, offsetMs };
}

/**
 * Selects the clock sample with the lowest round-trip time (first wins ties).
 */
export function selectBestClockSample(samples: readonly ClockSample[]): ClockSample {
  const initial = samples[0];
  if (!initial) {
    throw new Error('At least one clock sample is required');
  }

  let best = initial;
  for (let i = 1; i < samples.length; i += 1) {
    const candidate = samples[i];
    if (candidate && candidate.rtt < best.rtt) {
      best = candidate;
    }
  }
  return best;
}

export function computeCorrectedNowMs(localNowMs: number, offsetMs: number): number {
  return localNowMs + offsetMs;
}

export interface CountdownInput {
  phase: PodPhase;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  localNowMs: number;
  offsetMs: number;
}

/**
 * Calculates remaining milliseconds from the synchronized phaseEndsAt or pausedRemainingMs.
 */
export function computeCountdownMs({
  phase,
  phaseEndsAt,
  pausedRemainingMs,
  localNowMs,
  offsetMs,
}: CountdownInput): number {
  if (phase === 'LOBBY' || phase === 'COMPLETED') {
    return 0;
  }
  if (pausedRemainingMs !== null) {
    return Math.max(0, pausedRemainingMs);
  }
  if (phaseEndsAt === null) {
    return 0;
  }
  const correctedNow = computeCorrectedNowMs(localNowMs, offsetMs);
  return Math.max(0, phaseEndsAt - correctedNow);
}

/**
 * Returns normalized sweep progress in [0, 1] for the SVG timer ring.
 */
export function computeTimerProgress(
  remainingMs: number,
  phaseDurationSec: number,
  phase: PodPhase,
): number {
  if (phase === 'COMPLETED') {
    return 1;
  }
  if (phase === 'LOBBY') {
    return 0;
  }
  const totalMs = Math.max(1000, phaseDurationSec * 1000);
  const elapsedFraction = 1 - remainingMs / totalMs;
  if (elapsedFraction <= 0) return 0;
  if (elapsedFraction >= 1) return 1;
  return elapsedFraction;
}

/**
 * True only when an active FOCUS or BREAK timer is within its final 60 seconds.
 */
export function isLastSixtySeconds(
  phase: PodPhase,
  remainingMs: number,
  isPaused: boolean,
): boolean {
  if (isPaused) {
    return false;
  }
  if (phase !== 'FOCUS' && phase !== 'BREAK') {
    return false;
  }
  return remainingMs > 0 && remainingMs <= LAST_MINUTE_THRESHOLD_MS;
}

export function formatCountdown(remainingMs: number): string {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
