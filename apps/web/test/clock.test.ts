import { describe, expect, it } from 'vitest';
import {
  CLOCK_RECALIBRATE_MS,
  CLOCK_SAMPLE_COUNT,
  TIMER_RENDER_INTERVAL_MS,
  computeClockSample,
  computeCorrectedNowMs,
  computeCountdownMs,
  computeTimerProgress,
  formatCountdown,
  isLastSixtySeconds,
  selectBestClockSample,
} from '../src/features/realtime/clock';

describe('clock offset and countdown helpers (DESIGN B6)', () => {
  it('computes clock sample offset = serverNow - (t0 + rtt/2)', () => {
    // Client clock is 30,000ms behind server, RTT is 40ms
    const t0 = 1_000_000;
    const t1 = 1_000_040;
    const serverNow = 1_030_020;
    const sample = computeClockSample(t0, serverNow, t1);

    expect(sample.rtt).toBe(40);
    expect(sample.offsetMs).toBe(30_000);
  });

  it('selects sample with minimum RTT across simulated pings (first wins ties)', () => {
    const samples = [
      computeClockSample(1000, 31060, 1120), // rtt = 120
      computeClockSample(2000, 32010, 2020), // rtt = 20 -> smallest
      computeClockSample(3000, 33040, 3080), // rtt = 80
      computeClockSample(4000, 34010, 4020), // rtt = 20 tie -> loses to earlier index 1
      computeClockSample(5000, 35025, 5050), // rtt = 50
    ];

    const best = selectBestClockSample(samples);
    expect(best.t0).toBe(2000);
    expect(best.rtt).toBe(20);
    expect(best.offsetMs).toBe(30_000);
    expect(() => selectBestClockSample([])).toThrow();
  });

  it('keeps client countdown synchronized within 1s despite 30s device clock skew', () => {
    const trueServerNow = 1_700_000_000_000;
    const phaseEndsAt = trueServerNow + 45_000;

    // Client A is 30s slow; Client B is 15s fast
    const clientASkew = -30_000;
    const clientBSkew = +15_000;

    const sampleA = computeClockSample(
      trueServerNow + clientASkew,
      trueServerNow + 10,
      trueServerNow + clientASkew + 20,
    );
    const sampleB = computeClockSample(
      trueServerNow + clientBSkew,
      trueServerNow + 10,
      trueServerNow + clientBSkew + 20,
    );

    const remainingA = computeCountdownMs({
      phase: 'FOCUS',
      phaseEndsAt,
      pausedRemainingMs: null,
      localNowMs: trueServerNow + clientASkew,
      offsetMs: sampleA.offsetMs,
    });
    const remainingB = computeCountdownMs({
      phase: 'FOCUS',
      phaseEndsAt,
      pausedRemainingMs: null,
      localNowMs: trueServerNow + clientBSkew,
      offsetMs: sampleB.offsetMs,
    });

    expect(Math.abs(remainingA - remainingB)).toBeLessThanOrEqual(1000);
    expect(remainingA).toBe(45_000);
    expect(computeCorrectedNowMs(1000, 500)).toBe(1500);
  });

  it('uses pausedRemainingMs verbatim and zeroes LOBBY/COMPLETED countdowns', () => {
    expect(
      computeCountdownMs({
        phase: 'FOCUS',
        phaseEndsAt: null,
        pausedRemainingMs: 18_400,
        localNowMs: 9_999_999,
        offsetMs: 5000,
      }),
    ).toBe(18_400);

    expect(
      computeCountdownMs({
        phase: 'LOBBY',
        phaseEndsAt: 50_000,
        pausedRemainingMs: null,
        localNowMs: 10_000,
        offsetMs: 0,
      }),
    ).toBe(0);

    expect(
      computeCountdownMs({
        phase: 'COMPLETED',
        phaseEndsAt: 50_000,
        pausedRemainingMs: null,
        localNowMs: 10_000,
        offsetMs: 0,
      }),
    ).toBe(0);
  });

  it('computes timer progress, last-60s boundary, and MM:SS ceiling format', () => {
    expect(computeTimerProgress(1500_000, 1500, 'FOCUS')).toBe(0);
    expect(computeTimerProgress(750_000, 1500, 'FOCUS')).toBe(0.5);
    expect(computeTimerProgress(0, 1500, 'FOCUS')).toBe(1);
    expect(computeTimerProgress(1000, 60, 'COMPLETED')).toBe(1);
    expect(computeTimerProgress(1000, 60, 'LOBBY')).toBe(0);

    expect(isLastSixtySeconds('FOCUS', 60_000, false)).toBe(true);
    expect(isLastSixtySeconds('FOCUS', 60_001, false)).toBe(false);
    expect(isLastSixtySeconds('FOCUS', 30_000, true)).toBe(false);
    expect(isLastSixtySeconds('LOBBY', 30_000, false)).toBe(false);
    expect(isLastSixtySeconds('BREAK', 15_000, false)).toBe(true);

    expect(formatCountdown(59_001)).toBe('01:00');
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(0)).toBe('00:00');

    expect(CLOCK_SAMPLE_COUNT).toBe(5);
    expect(CLOCK_RECALIBRATE_MS).toBe(60_000);
    expect(TIMER_RENDER_INTERVAL_MS).toBe(250);
  });
});

