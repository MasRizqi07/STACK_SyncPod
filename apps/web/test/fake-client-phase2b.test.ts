import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchFallbackOfferEvent, PodSnapshot } from '@syncpod/shared';
import {
  DEMO_MATCH_SCHEDULE_MS,
  FakeRealtimeClient,
  type ConnectionState,
} from '../src/features/realtime';

describe('FakeRealtimeClient Phase 2b flows (D6, D7, D8, D9, FR-3.5)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects non-leaf module and short windows in matchEnqueue (D6)', async () => {
    const client = new FakeRealtimeClient();
    const now = Date.now();

    const nonLeafAck = await client.matchEnqueue({
      moduleId: 'course-if201',
      urgency: 'QUIZ_PREP',
      windowStart: now,
      windowEnd: now + 30 * 60_000,
    });
    expect(nonLeafAck.ok).toBe(false);
    if (!nonLeafAck.ok) {
      expect(nonLeafAck.error.code).toBe('VALIDATION_FAILED');
    }

    const shortWindowAck = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: now,
      windowEnd: now + 10 * 60_000,
    });
    expect(shortWindowAck.ok).toBe(false);
    if (!shortWindowAck.ok) {
      expect(shortWindowAck.error.code).toBe('VALIDATION_FAILED');
    }

    // Past-clamped window with 24m remaining fails, while 25m window with 10ms transit drift passes
    const clampedShortAck = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: now - 60_000,
      windowEnd: now - 60_000 + 25 * 60_000,
    });
    expect(clampedShortAck.ok).toBe(false);

    const transitJitterAck = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: now - 10,
      windowEnd: now - 10 + 25 * 60_000,
    });
    expect(transitJitterAck.ok).toBe(true);
    await client.matchCancel({});

    client.dispose();
  });

  it('handles 3-member fallback offer accept (3-member pod) and extend/expiry (FR-2.4, D7)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));

    const client = new FakeRealtimeClient({
      matchBehavior: 'fallback-offer',
      fallbackTtlMs: 60_000,
    });
    const offers: MatchFallbackOfferEvent[] = [];
    const found: string[] = [];

    client.on('match:fallback-offer', (ev) => offers.push(ev));
    client.on('match:found', (ev) => found.push(ev.podId));

    await client.matchEnqueue({
      moduleId: 'mod-eigen',
      urgency: 'THEORY_REVIEW',
      windowStart: Date.now(),
      windowEnd: Date.now() + 30 * 60_000,
    });

    await vi.advanceTimersByTimeAsync(DEMO_MATCH_SCHEDULE_MS[2]);
    expect(offers).toHaveLength(1);
    const offer = offers[0]!;
    expect(offer.count).toBe(3);

    const acceptAck = await client.matchFallbackReply({
      offerId: offer.offerId,
      accept: true,
    });
    expect(acceptAck).toEqual({ ok: true, data: { accepted: true } });
    expect(found).toEqual(['pod-042']);

    const joinAck = await client.podJoin({ podId: 'pod-042' });
    expect(joinAck.ok).toBe(true);
    if (joinAck.ok) {
      expect(joinAck.data.members).toHaveLength(3);
      expect(joinAck.data.module.id).toBe('mod-eigen');
      expect(joinAck.data.members.filter((m) => m.isSimulated)).toHaveLength(2);
    }

    // End sprint, then verify extend flow cancels offer cleanly
    await client.timerControl({ podId: 'pod-042', action: 'END' });
    offers.length = 0;

    await client.matchEnqueue({
      moduleId: 'mod-deadlock',
      urgency: 'STUCK_ASSIGNMENT',
      windowStart: Date.now(),
      windowEnd: Date.now() + 30 * 60_000,
    });
    await vi.advanceTimersByTimeAsync(DEMO_MATCH_SCHEDULE_MS[2]);
    expect(offers).toHaveLength(1);

    const extendAck = await client.matchFallbackReply({
      offerId: offers[0]!.offerId,
      extend: true,
    });
    expect(extendAck).toEqual({ ok: true, data: { accepted: false } });

    const duplicateReply = await client.matchFallbackReply({
      offerId: offers[0]!.offerId,
      accept: true,
    });
    expect(duplicateReply.ok).toBe(false);

    client.dispose();
  });

  it('fills remaining seats immediately with simulated peers via fillWithBotsForDemo (D8)', async () => {
    const client = new FakeRealtimeClient();
    const seats: number[] = [];
    const found: string[] = [];

    client.on('match:update', (ev) => seats.push(ev.seats));
    client.on('match:found', (ev) => found.push(ev.podId));

    const now = Date.now();
    await client.matchEnqueue({
      moduleId: 'mod-paging',
      urgency: 'QUIZ_PREP',
      windowStart: now,
      windowEnd: now + 30 * 60_000,
    });

    expect(client.fillWithBotsForDemo()).toBe(true);
    expect(seats).toEqual([1, 4]);
    expect(found).toEqual(['pod-042']);

    const joinAck = await client.podJoin({ podId: 'pod-042' });
    expect(joinAck.ok).toBe(true);
    if (joinAck.ok) {
      expect(joinAck.data.module.title).toContain('Paging');
    }

    client.dispose();
  });

  it('enforces ALREADY_IN_POD until sprint ends, tracks focusedSec, and emits connection state changes (D9, B6, FR-3.5)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));

    const client = new FakeRealtimeClient({ focusDurationSec: 60, breakDurationSec: 20 });
    const connStates: ConnectionState[] = [];
    client.onConnectionStateChange((s) => connStates.push(s));

    client.setConnectionState('reconnecting');
    client.setConnectionState('connected');
    expect(connStates).toEqual(['reconnecting', 'connected']);

    await client.podJoin({ podId: 'pod-042' });
    expect(client.getActivePodId()).toBe('pod-042');

    // Run 30s of FOCUS before leaving
    await vi.advanceTimersByTimeAsync(30_000);
    await client.podLeave({ podId: 'pod-042' });

    const now = Date.now();
    const blockedEnqueue = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: now,
      windowEnd: now + 25 * 60_000,
    });
    expect(blockedEnqueue.ok).toBe(false);
    if (!blockedEnqueue.ok) {
      expect(blockedEnqueue.error.code).toBe('ALREADY_IN_POD');
    }

    // Rejoin and end sprint -> unlocks matchmaking and records focusedSec
    const rejoinAck = await client.podJoin({ podId: 'pod-042' });
    expect(rejoinAck.ok).toBe(true);
    const endAck = await client.timerControl({ podId: 'pod-042', action: 'END' });
    expect(endAck.ok).toBe(true);
    if (endAck.ok) {
      const snap: PodSnapshot = endAck.data;
      expect(snap.phase).toBe('COMPLETED');
      expect((snap.members[0]?.focusedSec ?? 0)).toBeGreaterThanOrEqual(150);
    }

    expect(client.getActivePodId()).toBeNull();
    const freshEnqueue = await client.matchEnqueue({
      moduleId: 'mod-dijkstra',
      urgency: 'QUIZ_PREP',
      windowStart: Date.now(),
      windowEnd: Date.now() + 25 * 60_000,
    });
    expect(freshEnqueue.ok).toBe(true);

    client.dispose();
  });
});
