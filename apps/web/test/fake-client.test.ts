import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_BREAK_SECONDS,
  DEMO_FOCUS_SECONDS,
  DEMO_GEMINI_DELAY_MS,
  DEMO_MATCH_SCHEDULE_MS,
  FakeRealtimeClient,
} from '../src/features/realtime';

describe('FakeRealtimeClient deterministic contract (D19)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks matching seats 1/4 -> 4/4 on fixed schedule and auto-transitions demo FOCUS (60s) <-> BREAK (20s)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));

    const client = new FakeRealtimeClient();
    const seatsEvents: number[] = [];
    const foundPods: string[] = [];

    client.on('match:update', (ev) => seatsEvents.push(ev.seats));
    client.on('match:found', (ev) => foundPods.push(ev.podId));

    const enqueueAck = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: Date.now(),
      windowEnd: Date.now() + 25 * 60_000,
    });
    expect(enqueueAck.ok).toBe(true);
    expect(seatsEvents).toEqual([1]);

    await vi.advanceTimersByTimeAsync(DEMO_MATCH_SCHEDULE_MS[0]);
    expect(seatsEvents).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(
      DEMO_MATCH_SCHEDULE_MS[1] - DEMO_MATCH_SCHEDULE_MS[0],
    );
    expect(seatsEvents).toEqual([1, 2, 3]);
    await vi.advanceTimersByTimeAsync(
      DEMO_MATCH_SCHEDULE_MS[2] - DEMO_MATCH_SCHEDULE_MS[1],
    );
    expect(seatsEvents).toEqual([1, 2, 3, 4]);
    expect(foundPods).toEqual(['pod-042']);

    const joinAck = await client.podJoin({ podId: 'pod-042' });
    expect(joinAck.ok).toBe(true);
    if (!joinAck.ok) return;

    expect(joinAck.data.phase).toBe('FOCUS');
    expect(joinAck.data.phaseDurationSec).toBe(DEMO_FOCUS_SECONDS);
    expect(joinAck.data.members.filter((m) => m.isSimulated)).toHaveLength(3);

    const pauseAck = await client.timerControl({ podId: 'pod-042', action: 'PAUSE' });
    expect(pauseAck.ok).toBe(true);
    if (!pauseAck.ok) return;
    expect(pauseAck.data.pausedRemainingMs).not.toBeNull();
    expect(pauseAck.data.phaseEndsAt).toBeNull();

    const resumeAck = await client.timerControl({ podId: 'pod-042', action: 'RESUME' });
    expect(resumeAck.ok).toBe(true);
    if (!resumeAck.ok) return;
    expect(resumeAck.data.pausedRemainingMs).toBeNull();
    expect(resumeAck.data.phaseEndsAt).not.toBeNull();

    const skipAck = await client.timerControl({ podId: 'pod-042', action: 'SKIP' });
    expect(skipAck.ok).toBe(true);
    if (!skipAck.ok) return;
    expect(skipAck.data.phase).toBe('BREAK');
    expect(skipAck.data.phaseDurationSec).toBe(DEMO_BREAK_SECONDS);

    client.dispose();
  });

  it('enforces D14 single-question-ever limit and D5 idempotent Socratic hint', async () => {
    vi.useFakeTimers();
    const client = new FakeRealtimeClient();
    await client.podJoin({ podId: 'pod-042' });

    const first = await client.queueAdd({
      podId: 'pod-042',
      text: 'Mengapa antrean prioritas butuh min-heap?',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const secondBeforeResolve = await client.queueAdd({
      podId: 'pod-042',
      text: 'Pertanyaan kedua tidak boleh masuk',
    });
    expect(secondBeforeResolve.ok).toBe(false);
    if (!secondBeforeResolve.ok) {
      expect(secondBeforeResolve.error.code).toBe('QUESTION_LIMIT');
    }

    const resolveAck = await client.queueResolve({
      podId: 'pod-042',
      questionId: first.data.id,
    });
    expect(resolveAck.ok).toBe(true);

    // D14: resolving does not free the slot
    const secondAfterResolve = await client.queueAdd({
      podId: 'pod-042',
      text: 'Tetap ditolak setelah selesai',
    });
    expect(secondAfterResolve.ok).toBe(false);

    const results: string[] = [];
    client.on('socratic:result', (ev) => results.push(ev.hint.concept));

    const askAck = await client.socraticAsk({ podId: 'pod-042', questionId: 'q-042-1' });
    expect(askAck.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(DEMO_GEMINI_DELAY_MS);
    expect(results).toHaveLength(1);

    // Second ask reuses stored aiHint immediately without delay
    await client.socraticAsk({ podId: 'pod-042', questionId: 'q-042-1' });
    expect(results).toHaveLength(2);
    expect(results[0]).toBe(results[1]);

    client.dispose();
  });
});

