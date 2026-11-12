import { describe, expect, it } from 'vitest';
import type {
  ErrorCode,
  MatchFallbackOfferEvent,
  PodSnapshot,
  QuestionDTO,
} from '@syncpod/shared';
import {
  DEMO_BREAK_SECONDS,
  DEMO_FALLBACK_WAIT_MS,
  DEMO_FOCUS_SECONDS,
  DEMO_GEMINI_DELAY_MS,
  DEMO_MATCH_SCHEDULE_MS,
  type RealtimeClient,
} from '../src/features/realtime';

export interface RealtimeContractHarness {
  leaderClient: RealtimeClient;
  memberClient: RealtimeClient;
  outsiderClient: RealtimeClient;
  /** Optional simulated failure hook for testing ASKING_GEMINI release on error path. */
  simulateNextSocraticError?: (code?: Extract<ErrorCode, 'GEMINI_UNAVAILABLE' | 'GUARDRAIL_BLOCKED'>) => void;
  advanceTimeMs: (ms: number) => Promise<void>;
  dispose: () => Promise<void> | void;
}

export interface ContractSuiteOptions {
  createHarness: (options?: { scenario?: 'happy' | 'fallback' }) => Promise<RealtimeContractHarness> | RealtimeContractHarness;
}

export function runRealtimeClientContract(
  suiteName: string,
  { createHarness }: ContractSuiteOptions,
): void {
  describe(`${suiteName} RealtimeClient contract (G3)`, () => {
    it('enqueues valid request, progresses radar 1/4..4/4, rejects ALREADY_MATCHING & invalid payloads/modules/windows', async () => {
      const h = await createHarness({ scenario: 'happy' });
      try {
        const seats: number[] = [];
        const found: string[] = [];
        h.leaderClient.on('match:update', (ev) => seats.push(ev.seats));
        h.leaderClient.on('match:found', (ev) => found.push(ev.podId));

        // Invalid payload shape -> VALIDATION_FAILED
        const badPayload = await h.leaderClient.matchEnqueue({
          moduleId: '',
          urgency: 'QUIZ_PREP',
          windowStart: -1,
          windowEnd: 0,
        });
        expect(badPayload.ok).toBe(false);
        if (!badPayload.ok) expect(badPayload.error.code).toBe('VALIDATION_FAILED');

        const now = Date.now();

        // Non-leaf module -> VALIDATION_FAILED (D6)
        const nonLeaf = await h.leaderClient.matchEnqueue({
          moduleId: 'course-if201',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 30 * 60_000,
        });
        expect(nonLeaf.ok).toBe(false);
        if (!nonLeaf.ok) expect(nonLeaf.error.code).toBe('VALIDATION_FAILED');

        // Window < 25m -> VALIDATION_FAILED (D6)
        const shortWindow = await h.leaderClient.matchEnqueue({
          moduleId: 'mod-dijkstra',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 20 * 60_000,
        });
        expect(shortWindow.ok).toBe(false);
        if (!shortWindow.ok) expect(shortWindow.error.code).toBe('VALIDATION_FAILED');

        // Valid enqueue -> radar 1..4 -> found
        const ack1 = await h.leaderClient.matchEnqueue({
          moduleId: 'mod-dijkstra',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 25 * 60_000,
        });
        expect(ack1.ok).toBe(true);
        expect(seats).toEqual([1]);

        // Duplicate while waiting -> ALREADY_MATCHING
        const ackDup = await h.leaderClient.matchEnqueue({
          moduleId: 'mod-dijkstra',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 25 * 60_000,
        });
        expect(ackDup.ok).toBe(false);
        if (!ackDup.ok) expect(ackDup.error.code).toBe('ALREADY_MATCHING');

        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[0]);
        expect(seats).toEqual([1, 2]);
        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[1] - DEMO_MATCH_SCHEDULE_MS[0]);
        expect(seats).toEqual([1, 2, 3]);
        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[2] - DEMO_MATCH_SCHEDULE_MS[1]);
        expect(seats).toEqual([1, 2, 3, 4]);
        expect(found).toHaveLength(1);

        // Matched pod opens in LOBBY (S3)
        const joinAck = await h.leaderClient.podJoin({ podId: found[0]! });
        expect(joinAck.ok).toBe(true);
        if (joinAck.ok) {
          expect(joinAck.data.phase).toBe('LOBBY');
        }
      } finally {
        await h.dispose();
      }
    });

    it('enforces NOT_A_MEMBER, leader-only timer controls with ±1s pause/resume accuracy, and phase transitions', async () => {
      const h = await createHarness({ scenario: 'happy' });
      try {
        const found: string[] = [];
        h.leaderClient.on('match:found', (ev) => found.push(ev.podId));
        const now = Date.now();
        await h.leaderClient.matchEnqueue({
          moduleId: 'mod-dijkstra',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 30 * 60_000,
        });
        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[2]);
        const podId = found[0]!;

        // Non-member rejected across pod endpoints
        const outsiderJoin = await h.outsiderClient.podJoin({ podId });
        expect(outsiderJoin.ok).toBe(false);
        if (!outsiderJoin.ok) expect(outsiderJoin.error.code).toBe('NOT_A_MEMBER');

        const outsiderLeave = await h.outsiderClient.podLeave({ podId });
        expect(outsiderLeave.ok).toBe(false);
        if (!outsiderLeave.ok) expect(outsiderLeave.error.code).toBe('NOT_A_MEMBER');

        // Member joins LOBBY; non-leader cannot start or control timer
        const memberJoin = await h.memberClient.podJoin({ podId });
        expect(memberJoin.ok).toBe(true);

        const nonLeaderStart = await h.memberClient.podStart({ podId });
        expect(nonLeaderStart.ok).toBe(false);
        if (!nonLeaderStart.ok) expect(nonLeaderStart.error.code).toBe('FORBIDDEN');

        // Leader starts sprint -> FOCUS round 1
        const startAck = await h.leaderClient.podStart({ podId });
        expect(startAck.ok).toBe(true);
        if (!startAck.ok) return;
        expect(startAck.data.phase).toBe('FOCUS');
        expect(startAck.data.round).toBe(1);

        // Advance 15s, pause & resume preserve remaining time within ±1s
        await h.advanceTimeMs(15_000);
        const pauseAck = await h.leaderClient.timerControl({ podId, action: 'PAUSE' });
        expect(pauseAck.ok).toBe(true);
        if (!pauseAck.ok) return;
        expect(pauseAck.data.pausedRemainingMs).not.toBeNull();
        const pausedMs = pauseAck.data.pausedRemainingMs!;
        expect(Math.abs(pausedMs - (DEMO_FOCUS_SECONDS * 1000 - 15_000))).toBeLessThanOrEqual(1000);

        // Non-leader PAUSE/SKIP/END -> FORBIDDEN and state unchanged
        const memberResume = await h.memberClient.timerControl({ podId, action: 'RESUME' });
        expect(memberResume.ok).toBe(false);
        if (!memberResume.ok) expect(memberResume.error.code).toBe('FORBIDDEN');

        const checkAfterDenied = await h.memberClient.podJoin({ podId });
        expect(checkAfterDenied.ok).toBe(true);
        if (checkAfterDenied.ok) {
          expect(checkAfterDenied.data.pausedRemainingMs).toBe(pausedMs);
          expect(checkAfterDenied.data.phase).toBe('FOCUS');
        }

        // Wait 5s while paused -> remaining stays frozen; resume restores deadline
        await h.advanceTimeMs(5_000);
        const resumeAck = await h.leaderClient.timerControl({ podId, action: 'RESUME' });
        expect(resumeAck.ok).toBe(true);
        if (!resumeAck.ok) return;
        expect(resumeAck.data.pausedRemainingMs).toBeNull();
        expect(resumeAck.data.phaseEndsAt).not.toBeNull();
        const restoredRemaining = resumeAck.data.phaseEndsAt! - resumeAck.data.serverNow;
        expect(Math.abs(restoredRemaining - pausedMs)).toBeLessThanOrEqual(1000);

        // Complete FOCUS -> BREAK -> FOCUS round + 1 -> END -> COMPLETED
        const states: PodSnapshot[] = [];
        h.leaderClient.on('pod:state', (s) => states.push(s));

        await h.advanceTimeMs(restoredRemaining + 50);
        expect(states.at(-1)?.phase).toBe('BREAK');
        await h.advanceTimeMs(DEMO_BREAK_SECONDS * 1000 + 50);
        expect(states.at(-1)?.phase).toBe('FOCUS');
        expect(states.at(-1)?.round).toBe(2);

        const endAck = await h.leaderClient.timerControl({ podId, action: 'END' });
        expect(endAck.ok).toBe(true);
        if (endAck.ok) expect(endAck.data.phase).toBe('COMPLETED');
      } finally {
        await h.dispose();
      }
    });

    it('enforces single-question queue limit, resolve permissions, Socratic 3-question idempotency & error release, and endorsement rules', async () => {
      const h = await createHarness({ scenario: 'happy' });
      try {
        const now = Date.now();
        const found: string[] = [];
        h.leaderClient.on('match:found', (ev) => found.push(ev.podId));
        await h.leaderClient.matchEnqueue({
          moduleId: 'mod-dijkstra',
          urgency: 'QUIZ_PREP',
          windowStart: now,
          windowEnd: now + 30 * 60_000,
        });
        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[2]);
        const podId = found[0]!;
        await h.leaderClient.podJoin({ podId });
        await h.memberClient.podJoin({ podId });
        await h.leaderClient.podStart({ podId });

        // Queue add limit (D14) & invalid empty text
        const invalidQ = await h.memberClient.queueAdd({ podId, text: '   ' });
        expect(invalidQ.ok).toBe(false);
        if (!invalidQ.ok) expect(invalidQ.error.code).toBe('VALIDATION_FAILED');

        const outsiderQ = await h.outsiderClient.queueAdd({ podId, text: 'Pertanyaan penyusup' });
        expect(outsiderQ.ok).toBe(false);
        if (!outsiderQ.ok) expect(outsiderQ.error.code).toBe('NOT_A_MEMBER');

        const memberQ = await h.memberClient.queueAdd({
          podId,
          text: 'Mengapa priority queue memproses jarak terpendek lebih dulu?',
        });
        expect(memberQ.ok).toBe(true);
        if (!memberQ.ok) return;
        const memberQuestion: QuestionDTO = memberQ.data;

        const leaderQ = await h.leaderClient.queueAdd({
          podId,
          text: 'Apa perbedaan kompleksitas binary heap vs array?',
        });
        expect(leaderQ.ok).toBe(true);
        if (!leaderQ.ok) return;

        // Second question by member -> QUESTION_LIMIT
        const dupMemberQ = await h.memberClient.queueAdd({
          podId,
          text: 'Pertanyaan kedua tidak boleh masuk',
        });
        expect(dupMemberQ.ok).toBe(false);
        if (!dupMemberQ.ok) expect(dupMemberQ.error.code).toBe('QUESTION_LIMIT');

        // Member cannot resolve leader's question -> FORBIDDEN
        const forbiddenResolve = await h.memberClient.queueResolve({
          podId,
          questionId: leaderQ.data.id,
        });
        expect(forbiddenResolve.ok).toBe(false);
        if (!forbiddenResolve.ok) expect(forbiddenResolve.error.code).toBe('FORBIDDEN');

        // Leader can resolve member's question, and slot stays occupied (D14)
        const leaderResolve = await h.leaderClient.queueResolve({
          podId,
          questionId: memberQuestion.id,
        });
        expect(leaderResolve.ok).toBe(true);

        const afterResolveAdd = await h.memberClient.queueAdd({
          podId,
          text: 'Setelah selesai tetap dibatasi',
        });
        expect(afterResolveAdd.ok).toBe(false);
        if (!afterResolveAdd.ok) expect(afterResolveAdd.error.code).toBe('QUESTION_LIMIT');

        // Socratic error releases ASKING_GEMINI status (G3)
        if (h.simulateNextSocraticError) {
          const presenceLog: string[] = [];
          h.memberClient.on('presence:update', (ev) => {
            if (ev.userId === h.memberClient.getCurrentUserId()) presenceLog.push(ev.status);
          });
          h.simulateNextSocraticError('GEMINI_UNAVAILABLE');
          const failAsk = await h.memberClient.socraticAsk({ podId, questionId: memberQuestion.id });
          expect(failAsk.ok).toBe(true);
          await h.advanceTimeMs(DEMO_GEMINI_DELAY_MS + 50);
          expect(presenceLog[0]).toBe('ASKING_GEMINI');
          expect(presenceLog.at(-1)).not.toBe('ASKING_GEMINI');
        }

        // Socratic success returns 3 guiding questions & is idempotent (D5)
        const hints: string[] = [];
        h.leaderClient.on('socratic:result', (ev) => {
          expect(ev.hint.guidingQuestions).toHaveLength(3);
          hints.push(ev.hint.concept);
        });
        const askOk = await h.leaderClient.socraticAsk({ podId, questionId: leaderQ.data.id });
        expect(askOk.ok).toBe(true);
        await h.advanceTimeMs(DEMO_GEMINI_DELAY_MS + 50);
        expect(hints).toHaveLength(1);

        await h.leaderClient.socraticAsk({ podId, questionId: leaderQ.data.id });
        expect(hints).toHaveLength(2);
        expect(hints[0]).toBe(hints[1]);

        // Endorsement before COMPLETED -> INVALID_STATE
        const endorseEarly = await h.leaderClient.endorseGive({
          podId,
          toUserId: h.memberClient.getCurrentUserId(),
        });
        expect(endorseEarly.ok).toBe(false);
        if (!endorseEarly.ok) expect(endorseEarly.error.code).toBe('INVALID_STATE');

        await h.leaderClient.timerControl({ podId, action: 'END' });

        // Self-endorse -> FORBIDDEN
        const endorseSelf = await h.leaderClient.endorseGive({
          podId,
          toUserId: h.leaderClient.getCurrentUserId(),
        });
        expect(endorseSelf.ok).toBe(false);
        if (!endorseSelf.ok) expect(endorseSelf.error.code).toBe('FORBIDDEN');

        // Valid endorse succeeds, duplicate -> INVALID_STATE
        const endorseFirst = await h.leaderClient.endorseGive({
          podId,
          toUserId: h.memberClient.getCurrentUserId(),
        });
        expect(endorseFirst.ok).toBe(true);

        const endorseSecond = await h.leaderClient.endorseGive({
          podId,
          toUserId: h.memberClient.getCurrentUserId(),
        });
        expect(endorseSecond.ok).toBe(false);
        if (!endorseSecond.ok) expect(endorseSecond.error.code).toBe('INVALID_STATE');
      } finally {
        await h.dispose();
      }
    });

    it('executes D7/D24 fallback scenario: stops at 3/4, waits constant period, emits 60s offer, forms 3-member pod on accept and cancels on extend', async () => {
      const h = await createHarness({ scenario: 'fallback' });
      try {
        const seats: number[] = [];
        const offers: MatchFallbackOfferEvent[] = [];
        const found: string[] = [];
        h.leaderClient.on('match:update', (ev) => seats.push(ev.seats));
        h.leaderClient.on('match:fallback-offer', (ev) => offers.push(ev));
        h.leaderClient.on('match:found', (ev) => found.push(ev.podId));

        const now = Date.now();
        await h.leaderClient.matchEnqueue({
          moduleId: 'mod-eigen',
          urgency: 'THEORY_REVIEW',
          windowStart: now,
          windowEnd: now + 30 * 60_000,
        });

        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[1]);
        expect(seats).toEqual([1, 2, 3]);
        expect(offers).toHaveLength(0);

        // Wait constant fallback delay -> offer emitted (count: 3)
        await h.advanceTimeMs(DEMO_FALLBACK_WAIT_MS);
        expect(offers).toHaveLength(1);
        expect(offers[0]?.count).toBe(3);
        expect(found).toHaveLength(0);

        // Extend cancels offer -> stays searching without forming pod
        const extendAck = await h.leaderClient.matchFallbackReply({
          offerId: offers[0]!.offerId,
          extend: true,
        });
        expect(extendAck).toEqual({ ok: true, data: { accepted: false } });
        expect(found).toHaveLength(0);

        await h.leaderClient.matchCancel({});

        // Enqueue again -> accept fallback offer -> 3-member pod in LOBBY
        offers.length = 0;
        await h.leaderClient.matchEnqueue({
          moduleId: 'mod-eigen',
          urgency: 'THEORY_REVIEW',
          windowStart: Date.now(),
          windowEnd: Date.now() + 30 * 60_000,
        });
        await h.advanceTimeMs(DEMO_MATCH_SCHEDULE_MS[1] + DEMO_FALLBACK_WAIT_MS);
        expect(offers).toHaveLength(1);

        const acceptAck = await h.leaderClient.matchFallbackReply({
          offerId: offers[0]!.offerId,
          accept: true,
        });
        expect(acceptAck).toEqual({ ok: true, data: { accepted: true } });
        expect(found).toHaveLength(1);

        const joinAck = await h.leaderClient.podJoin({ podId: found[0]! });
        expect(joinAck.ok).toBe(true);
        if (joinAck.ok) {
          expect(joinAck.data.members).toHaveLength(3);
          expect(joinAck.data.phase).toBe('LOBBY');
        }
      } finally {
        await h.dispose();
      }
    });
  });
}

