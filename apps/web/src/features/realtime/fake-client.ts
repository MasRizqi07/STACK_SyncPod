import {
  endorseGivePayloadSchema,
  matchCancelPayloadSchema,
  matchEnqueuePayloadSchema,
  matchFallbackReplyPayloadSchema,
  podJoinPayloadSchema,
  podLeavePayloadSchema,
  podStartPayloadSchema,
  presenceSetPayloadSchema,
  queueAddPayloadSchema,
  queueResolvePayloadSchema,
  socraticAskPayloadSchema,
  timePingPayloadSchema,
  timerControlPayloadSchema,
  type Ack,
  type EndorseGivePayload,
  type ErrorCode,
  type MatchCancelPayload,
  type MatchEnqueuePayload,
  type MatchEnqueueResult,
  type MatchFallbackReplyPayload,
  type PodIdPayload,
  type PodMemberDTO,
  type PodSnapshot,
  type PresenceSetPayload,
  type QuestionDTO,
  type QueueAddPayload,
  type QueueResolvePayload,
  type ServerToClientEvents,
  type SocraticAskPayload,
  type TimePingPayload,
  type TimePingResult,
  type TimerControlPayload,
} from '@syncpod/shared';
import { COPY } from '@/copy';
import { MIN_WINDOW_MS, findModuleNodeById, type ModuleTreeNode } from '@/features/matchmaking';
import {
  DEMO_BREAK_SECONDS,
  DEMO_CURRENT_USER,
  DEMO_FALLBACK_TTL_MS,
  DEMO_FALLBACK_WAIT_MS,
  DEMO_FOCUS_SECONDS,
  DEMO_GEMINI_DELAY_MS,
  DEMO_INITIAL_NOTES,
  DEMO_MATCH_SCHEDULE_MS,
  DEMO_MAX_ROUNDS,
  DEMO_MODULE_DIJKSTRA,
  DEMO_SIMULATED_PEERS,
  buildDeterministicSocraticHint,
  buildModuleInitialNotes,
  createDemoSeedQuestion,
} from './constants';
import {
  FakeWorldStore,
  type ActiveOffer,
  type FakeStoreClient,
  type PodRecord,
} from './fake-world-store';
import type { ConnectionState, RealtimeClient, Unsubscribe } from './types';

export interface PersistedFakeState {
  activeJoinedPodId: string | null;
  questionCounter: number;
  pod: {
    podId: string;
    module: { id: string; title: string; path: string[] };
    phase: 'LOBBY' | 'FOCUS' | 'BREAK' | 'COMPLETED';
    round: number;
    phaseEndsAt: number | null;
    pausedRemainingMs: number | null;
    phaseDurationSec: number;
    focusDurationSec: number;
    breakDurationSec: number;
    leaderId: string;
    members: PodMemberDTO[];
    questions: QuestionDTO[];
    notes: string;
  };
}

interface EventMap {
  'match:update': Set<ServerToClientEvents['match:update']>;
  'match:found': Set<ServerToClientEvents['match:found']>;
  'match:fallback-offer': Set<ServerToClientEvents['match:fallback-offer']>;
  'pod:state': Set<ServerToClientEvents['pod:state']>;
  'presence:update': Set<ServerToClientEvents['presence:update']>;
  'queue:update': Set<ServerToClientEvents['queue:update']>;
  'socratic:result': Set<ServerToClientEvents['socratic:result']>;
  'socratic:error': Set<ServerToClientEvents['socratic:error']>;
}

export type FakeMatchBehavior = 'auto-full' | 'fallback-offer';

export interface FakeRealtimeClientOptions {
  now?: () => number;
  focusDurationSec?: number;
  breakDurationSec?: number;
  maxRounds?: number;
  geminiDelayMs?: number;
  matchBehavior?: FakeMatchBehavior;
  fallbackTtlMs?: number;
  onStatePersist?: (state: PersistedFakeState) => void;
  store?: FakeWorldStore;
  user?: {
    userId: string;
    name: string;
    universityName?: string;
  };
  scenario?: 'happy' | 'fallback';
}

function fail<T>(code: ErrorCode, message: string): Ack<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): Ack<T> {
  return { ok: true, data };
}

export class FakeRealtimeClient implements RealtimeClient, FakeStoreClient {
  private readonly now: () => number;
  private readonly focusDurationSec: number;
  private readonly breakDurationSec: number;
  private readonly maxRounds: number;
  private readonly geminiDelayMs: number;
  private readonly matchBehavior: FakeMatchBehavior;
  private readonly fallbackTtlMs: number;
  private onStatePersist?: (state: PersistedFakeState) => void;

  private readonly store: FakeWorldStore;
  private readonly currentUser: { userId: string; name: string; universityName?: string };
  private readonly scenario: 'happy' | 'fallback';
  private readonly isExternalStore: boolean;

  private connectionState: ConnectionState = 'connected';
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>();
  private readonly listeners: EventMap = {
    'match:update': new Set(),
    'match:found': new Set(),
    'match:fallback-offer': new Set(),
    'pod:state': new Set(),
    'presence:update': new Set(),
    'queue:update': new Set(),
    'socratic:result': new Set(),
    'socratic:error': new Set(),
  };

  private readonly matchTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly socraticInFlight = new Map<string, Promise<void>>();
  private activeMatchRequestId: string | null = null;
  private activeMatchModule: ModuleTreeNode | null = null;
  private activeOffer: ActiveOffer | null = null;
  private activeJoinedPodId: string | null = null;
  private matchCounter = 0;

  constructor(options: FakeRealtimeClientOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.focusDurationSec = options.focusDurationSec ?? DEMO_FOCUS_SECONDS;
    this.breakDurationSec = options.breakDurationSec ?? DEMO_BREAK_SECONDS;
    this.maxRounds = options.maxRounds ?? DEMO_MAX_ROUNDS;
    this.geminiDelayMs = options.geminiDelayMs ?? DEMO_GEMINI_DELAY_MS;
    this.matchBehavior = options.matchBehavior ?? 'auto-full';
    this.fallbackTtlMs = options.fallbackTtlMs ?? DEMO_FALLBACK_TTL_MS;
    this.onStatePersist = options.onStatePersist;

    this.currentUser = options.user ?? DEMO_CURRENT_USER;
    this.scenario =
      options.scenario ?? (this.matchBehavior === 'fallback-offer' ? 'fallback' : 'happy');
    this.isExternalStore = options.store !== undefined;
    this.store = options.store ?? new FakeWorldStore();
    this.store.registerClient(this);

    // If standalone client without external store, seed the default demo pod
    if (!this.isExternalStore && !this.store.pods.has('pod-042')) {
      this.seedDefaultPod();
    }
  }

  public emitLocal<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    const bucket = this.listeners[event] as Set<ServerToClientEvents[K]>;
    for (const listener of bucket) {
      (listener as (arg: unknown) => void)(payload);
    }
  }

  public setStatePersistHandler(handler: ((state: PersistedFakeState) => void) | undefined): void {
    this.onStatePersist = handler;
  }

  private persistNow(): void {
    if (!this.onStatePersist) return;
    const exported = this.exportState();
    if (exported) {
      this.onStatePersist(exported);
    }
  }

  public exportState(): PersistedFakeState | null {
    const pod = this.store.pods.get('pod-042');
    if (!pod) return null;
    const snap = this.toSnapshot(pod);
    return {
      activeJoinedPodId: this.activeJoinedPodId,
      questionCounter: this.store.getQuestionCounter(),
      pod: {
        podId: snap.podId,
        module: snap.module,
        phase: snap.phase,
        round: snap.round,
        phaseEndsAt: snap.phaseEndsAt,
        pausedRemainingMs: snap.pausedRemainingMs,
        phaseDurationSec: snap.phaseDurationSec,
        focusDurationSec: pod.focusDurationSec,
        breakDurationSec: pod.breakDurationSec,
        leaderId: snap.leaderId,
        members: snap.members,
        questions: snap.questions,
        notes: pod.notes,
      },
    };
  }

  public importState(persisted: PersistedFakeState): void {
    this.store.clearPhaseTimer('pod-042');
    const t = this.now();
    const p = persisted.pod;
    const record: PodRecord = {
      podId: p.podId,
      module: { ...p.module, path: [...p.module.path] },
      phase: p.phase,
      round: p.round,
      phaseEndsAt: p.phaseEndsAt,
      pausedRemainingMs: p.pausedRemainingMs,
      phaseDurationSec: p.phaseDurationSec,
      focusDurationSec: p.focusDurationSec,
      breakDurationSec: p.breakDurationSec,
      focusSegmentStartedAt: p.phase === 'FOCUS' && p.pausedRemainingMs === null ? t : null,
      leaderId: p.leaderId,
      members: p.members.map((m) => ({ ...m })),
      questions: p.questions.map((q) => ({ ...q })),
      notes: p.notes,
      endorsements: new Set(),
    };

    if (
      record.phaseEndsAt !== null &&
      record.pausedRemainingMs === null &&
      record.phaseEndsAt <= t &&
      (record.phase === 'FOCUS' || record.phase === 'BREAK')
    ) {
      record.phase = 'FOCUS';
      record.phaseDurationSec = record.focusDurationSec;
      record.phaseEndsAt = t + record.focusDurationSec * 1000;
      record.focusSegmentStartedAt = t;
    }

    this.activeJoinedPodId = persisted.activeJoinedPodId;
    this.store.resetQuestionCounter(persisted.questionCounter);
    this.store.pods.set(record.podId, record);
    this.schedulePhaseTransition(record.podId);
  }

  private seedDefaultPod(): void {
    const t = this.now();
    const members: PodMemberDTO[] = [
      {
        userId: this.currentUser.userId,
        name: this.currentUser.name,
        universityName: this.currentUser.universityName,
        role: 'LEADER',
        status: 'IN_FOCUS',
        focusedSec: 120,
      },
      ...DEMO_SIMULATED_PEERS.map((peer) => ({ ...peer })),
    ];

    const record: PodRecord = {
      podId: 'pod-042',
      module: DEMO_MODULE_DIJKSTRA,
      phase: 'FOCUS',
      round: 1,
      phaseEndsAt: t + this.focusDurationSec * 1000,
      pausedRemainingMs: null,
      phaseDurationSec: this.focusDurationSec,
      focusDurationSec: this.focusDurationSec,
      breakDurationSec: this.breakDurationSec,
      focusSegmentStartedAt: t,
      leaderId: this.currentUser.userId,
      members,
      questions: [createDemoSeedQuestion('pod-042', t - 45_000)],
      notes: DEMO_INITIAL_NOTES,
      endorsements: new Set(),
    };

    this.store.pods.set(record.podId, record);
    this.schedulePhaseTransition(record.podId);
  }

  private resetMatchedPod(moduleNode: ModuleTreeNode, memberCount: 3 | 4): PodRecord {
    this.store.clearPhaseTimer('pod-042');
    const t = this.now();
    const peerLimit = memberCount === 3 ? 2 : 3;
    const members: PodMemberDTO[] = [
      {
        userId: this.currentUser.userId,
        name: this.currentUser.name,
        universityName: this.currentUser.universityName,
        role: 'LEADER',
        status: 'IN_FOCUS',
        focusedSec: 0,
      },
      ...DEMO_SIMULATED_PEERS.slice(0, peerLimit).map((peer) => ({
        ...peer,
        focusedSec: 0,
      })),
    ];

    const notes = buildModuleInitialNotes(moduleNode.title);
    const seedQuestion = createDemoSeedQuestion('pod-042', t, moduleNode.id, moduleNode.title);

    // If external store is provided (contract test suite), matched pod starts in LOBBY (S3 / D21)
    // If standalone default client, start in FOCUS for demo/tests
    const initialPhase = this.isExternalStore ? 'LOBBY' : 'FOCUS';

    const record: PodRecord = {
      podId: 'pod-042',
      module: {
        id: moduleNode.id,
        title: moduleNode.title,
        path: [...moduleNode.path],
      },
      phase: initialPhase,
      round: initialPhase === 'LOBBY' ? 0 : 1,
      phaseEndsAt: initialPhase === 'LOBBY' ? null : t + this.focusDurationSec * 1000,
      pausedRemainingMs: null,
      phaseDurationSec: this.focusDurationSec,
      focusDurationSec: this.focusDurationSec,
      breakDurationSec: this.breakDurationSec,
      focusSegmentStartedAt: initialPhase === 'LOBBY' ? null : t,
      leaderId: this.currentUser.userId,
      members,
      questions: [seedQuestion],
      notes,
      endorsements: new Set(),
    };

    this.store.resetQuestionCounter(1);
    this.store.pods.set(record.podId, record);
    this.activeJoinedPodId = record.podId;
    if (initialPhase !== 'LOBBY') {
      this.schedulePhaseTransition(record.podId);
    }
    this.persistNow();
    return record;
  }

  private accrueFocusSeconds(pod: PodRecord, atMs: number): void {
    if (pod.phase !== 'FOCUS' || pod.pausedRemainingMs !== null || pod.focusSegmentStartedAt === null) {
      pod.focusSegmentStartedAt = null;
      return;
    }
    const elapsedSec = Math.max(0, Math.floor((atMs - pod.focusSegmentStartedAt) / 1000));
    if (elapsedSec > 0) {
      for (const member of pod.members) {
        if (member.status !== 'DISCONNECTED') {
          member.focusedSec = (member.focusedSec ?? 0) + elapsedSec;
        }
      }
    }
    pod.focusSegmentStartedAt = atMs;
  }

  private toSnapshot(pod: PodRecord): PodSnapshot {
    return {
      podId: pod.podId,
      module: { ...pod.module, path: [...pod.module.path] },
      phase: pod.phase,
      round: pod.round,
      phaseEndsAt: pod.phaseEndsAt,
      pausedRemainingMs: pod.pausedRemainingMs,
      phaseDurationSec: pod.phaseDurationSec,
      serverNow: this.now(),
      leaderId: pod.leaderId,
      members: pod.members.map((m) => ({ ...m })),
      questions: pod.questions.map((q) => ({
        ...q,
        aiHint: q.aiHint
          ? {
              concept: q.aiHint.concept,
              guidingQuestions: [...q.aiHint.guidingQuestions],
              analogy: q.aiHint.analogy,
              docHint: q.aiHint.docHint ? { ...q.aiHint.docHint } : undefined,
            }
          : null,
      })),
    };
  }

  private clearAllMatchTimers(): void {
    for (const timer of this.matchTimers) {
      clearTimeout(timer);
    }
    this.matchTimers.clear();
    if (this.activeOffer) {
      clearTimeout(this.activeOffer.timer);
      this.activeOffer = null;
    }
  }

  private schedulePhaseTransition(podId: string): void {
    this.store.clearPhaseTimer(podId);
    const pod = this.store.pods.get(podId);
    if (!pod || pod.phaseEndsAt === null || pod.pausedRemainingMs !== null) {
      return;
    }
    const delay = Math.max(0, pod.phaseEndsAt - this.now());
    const timer = setTimeout(() => {
      this.advancePhase(podId);
    }, delay);
    this.store.activePhaseTimers.set(podId, timer);
  }

  private advancePhase(podId: string): void {
    const pod = this.store.pods.get(podId);
    if (!pod) return;
    const t = this.now();

    if (pod.phase === 'FOCUS') {
      this.accrueFocusSeconds(pod, t);
      if (pod.round >= this.maxRounds) {
        pod.phase = 'COMPLETED';
        pod.phaseEndsAt = null;
        pod.pausedRemainingMs = null;
        pod.focusSegmentStartedAt = null;
        this.store.clearPhaseTimer(podId);
        if (this.activeJoinedPodId === podId) {
          this.activeJoinedPodId = null;
        }
      } else {
        pod.phase = 'BREAK';
        pod.phaseDurationSec = pod.breakDurationSec;
        pod.phaseEndsAt = t + pod.breakDurationSec * 1000;
        pod.pausedRemainingMs = null;
        pod.focusSegmentStartedAt = null;
        this.schedulePhaseTransition(podId);
      }
    } else if (pod.phase === 'BREAK') {
      pod.phase = 'FOCUS';
      pod.round += 1;
      pod.phaseDurationSec = pod.focusDurationSec;
      pod.phaseEndsAt = t + pod.focusDurationSec * 1000;
      pod.pausedRemainingMs = null;
      pod.focusSegmentStartedAt = t;
      this.schedulePhaseTransition(podId);
    }

    this.persistNow();
    this.store.broadcast('pod:state', this.toSnapshot(pod));
  }

  public getCurrentUserId(): string {
    return this.currentUser.userId;
  }

  public getActivePodId(): string | null {
    if (!this.activeJoinedPodId) return null;
    const pod = this.store.pods.get(this.activeJoinedPodId);
    if (!pod || pod.phase === 'COMPLETED') {
      return null;
    }
    return pod.podId;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public setConnectionState(next: ConnectionState): void {
    if (this.connectionState === next) return;
    this.connectionState = next;
    for (const listener of this.connectionListeners) {
      listener(next);
    }
  }

  public onConnectionStateChange(listener: (state: ConnectionState) => void): Unsubscribe {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  public on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ): Unsubscribe {
    const bucket = this.listeners[event] as Set<ServerToClientEvents[K]>;
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
    };
  }

  public async timePing(payload: TimePingPayload): Promise<Ack<TimePingResult>> {
    const parsed = timePingPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Payload ping tidak valid.');
    }
    return ok({ t0: parsed.data.t0, serverNow: this.now() });
  }

  public async matchEnqueue(payload: MatchEnqueuePayload): Promise<Ack<MatchEnqueueResult>> {
    const parsed = matchEnqueuePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Permintaan pencarian pod tidak valid.');
    }

    const moduleNode = findModuleNodeById(parsed.data.moduleId);
    if (!moduleNode || !moduleNode.isLeaf) {
      return fail('VALIDATION_FAILED', COPY.matchmaking.moduleHintNonLeaf);
    }

    const t = this.now();
    if (parsed.data.windowEnd <= t) {
      return fail('VALIDATION_FAILED', COPY.errors.windowPast);
    }
    if (parsed.data.windowEnd - parsed.data.windowStart < MIN_WINDOW_MS) {
      return fail('VALIDATION_FAILED', COPY.errors.windowTooShort);
    }
    const clampedStart = Math.max(parsed.data.windowStart, t);
    // Allow up to 5 s event/transit jitter so [now, now + 25m] succeeds cleanly across ticks.
    const transitGraceMs = 5_000;
    if (parsed.data.windowEnd - clampedStart < MIN_WINDOW_MS - transitGraceMs) {
      return fail('VALIDATION_FAILED', COPY.errors.windowTooShort);
    }

    const existingActivePod = this.getActivePodId();
    if (existingActivePod) {
      return fail('ALREADY_IN_POD', COPY.errors.alreadyInPod);
    }

    if (this.activeMatchRequestId) {
      return fail('ALREADY_MATCHING', COPY.errors.alreadyMatching);
    }

    this.matchCounter += 1;
    const requestId = `req-demo-${this.matchCounter}`;
    this.activeMatchRequestId = requestId;
    this.activeMatchModule = moduleNode;

    this.emitLocal('match:update', { waitingCount: 1, seats: 1 });

    const isFallbackMode =
      this.scenario === 'fallback' || this.matchBehavior === 'fallback-offer';

    DEMO_MATCH_SCHEDULE_MS.forEach((delayMs, index) => {
      const seatCount = index + 2;

      // In fallback mode, seat 4 is NOT emitted; fallback offer is emitted after DEMO_FALLBACK_WAIT_MS
      if (isFallbackMode && seatCount === 4) {
        const fallbackOfferDelay = DEMO_MATCH_SCHEDULE_MS[1] + DEMO_FALLBACK_WAIT_MS;
        const offerTimer = setTimeout(() => {
          this.matchTimers.delete(offerTimer);
          if (this.activeMatchRequestId !== requestId) {
            return;
          }

          const offerId = `offer-demo-${this.matchCounter}`;
          const expiresAt = this.now() + this.fallbackTtlMs;
          const expireTimer = setTimeout(() => {
            if (this.activeOffer?.offerId === offerId) {
              this.activeOffer = null;
            }
          }, this.fallbackTtlMs);

          this.activeOffer = {
            offerId,
            requestId,
            module: moduleNode,
            expiresAt,
            timer: expireTimer,
          };
          this.emitLocal('match:fallback-offer', {
            offerId,
            count: 3,
            expiresAt,
          });
        }, fallbackOfferDelay);
        this.matchTimers.add(offerTimer);
        return;
      }

      const timer = setTimeout(() => {
        this.matchTimers.delete(timer);
        if (this.activeMatchRequestId !== requestId) {
          return;
        }

        this.emitLocal('match:update', { waitingCount: seatCount, seats: seatCount });
        if (seatCount === 4) {
          this.activeMatchRequestId = null;
          this.activeMatchModule = null;
          const pod = this.resetMatchedPod(moduleNode, 4);
          this.emitLocal('match:found', { podId: pod.podId });
        }
      }, delayMs);
      this.matchTimers.add(timer);
    });

    return ok({ requestId });
  }

  /**
   * Demo-mode only helper (D8): immediately fills remaining empty seats with
   * simulated peers ("Simulasi") and transitions into the matched pod.
   */
  public fillWithBotsForDemo(): boolean {
    if (!this.activeMatchRequestId || !this.activeMatchModule) {
      return false;
    }
    const moduleNode = this.activeMatchModule;
    this.clearAllMatchTimers();
    this.activeMatchRequestId = null;
    this.activeMatchModule = null;

    this.emitLocal('match:update', { waitingCount: 4, seats: 4 });
    const pod = this.resetMatchedPod(moduleNode, 4);
    this.emitLocal('match:found', { podId: pod.podId });
    return true;
  }

  public async matchCancel(payload: MatchCancelPayload): Promise<Ack<{ cancelled: true }>> {
    const parsed = matchCancelPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Payload pembatalan tidak valid.');
    }
    this.activeMatchRequestId = null;
    this.activeMatchModule = null;
    this.clearAllMatchTimers();
    return ok({ cancelled: true });
  }

  public async matchFallbackReply(
    payload: MatchFallbackReplyPayload,
  ): Promise<Ack<{ accepted: boolean }>> {
    const parsed = matchFallbackReplyPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Balasan tawaran tidak valid.');
    }

    const offer = this.activeOffer;
    if (!offer || offer.offerId !== parsed.data.offerId) {
      return fail('INVALID_STATE', 'Tawaran memulai bertiga sudah tidak aktif.');
    }

    clearTimeout(offer.timer);
    this.activeOffer = null;

    if (this.now() >= offer.expiresAt) {
      return fail('INVALID_STATE', 'Batas waktu tawaran sudah habis.');
    }

    if ('accept' in parsed.data && parsed.data.accept) {
      this.clearAllMatchTimers();
      this.activeMatchRequestId = null;
      this.activeMatchModule = null;
      const pod = this.resetMatchedPod(offer.module, 3);
      this.emitLocal('match:found', { podId: pod.podId });
      return ok({ accepted: true });
    }

    return ok({ accepted: false });
  }

  public async podJoin(payload: PodIdPayload): Promise<Ack<PodSnapshot>> {
    const parsed = podJoinPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === this.getCurrentUserId());
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    if (pod.phase !== 'COMPLETED' && member.status === 'DISCONNECTED') {
      member.status = 'IN_FOCUS';
    }
    if (pod.phase !== 'COMPLETED') {
      this.activeJoinedPodId = pod.podId;
    } else if (this.activeJoinedPodId === pod.podId) {
      this.activeJoinedPodId = null;
    }
    this.persistNow();
    const snapshot = this.toSnapshot(pod);
    this.store.broadcast('pod:state', snapshot);
    return ok(snapshot);
  }

  public async podLeave(payload: PodIdPayload): Promise<Ack<{ left: true }>> {
    const parsed = podLeavePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === this.getCurrentUserId());
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    if (pod.phase === 'FOCUS') {
      this.accrueFocusSeconds(pod, this.now());
    }
    member.status = 'DISCONNECTED';
    if (pod.phase !== 'COMPLETED') {
      this.activeJoinedPodId = pod.podId;
    }
    this.persistNow();
    this.store.broadcast('presence:update', { userId: member.userId, status: 'DISCONNECTED' });
    this.store.broadcast('pod:state', this.toSnapshot(pod));
    return ok({ left: true });
  }

  public async podStart(payload: PodIdPayload): Promise<Ack<PodSnapshot>> {
    const parsed = podStartPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.leaderId !== this.getCurrentUserId()) {
      return fail('FORBIDDEN', 'Hanya leader yang bisa memulai sprint.');
    }
    if (pod.phase !== 'LOBBY') {
      return fail('INVALID_STATE', 'Pod sudah dimulai.');
    }
    const t = this.now();
    pod.phase = 'FOCUS';
    pod.round = 1;
    pod.phaseDurationSec = pod.focusDurationSec;
    pod.phaseEndsAt = t + pod.focusDurationSec * 1000;
    pod.pausedRemainingMs = null;
    pod.focusSegmentStartedAt = t;

    this.schedulePhaseTransition(pod.podId);
    this.persistNow();
    const snapshot = this.toSnapshot(pod);
    this.store.broadcast('pod:state', snapshot);
    return ok(snapshot);
  }

  public async timerControl(payload: TimerControlPayload): Promise<Ack<PodSnapshot>> {
    const parsed = timerControlPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Kontrol timer tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.leaderId !== this.getCurrentUserId()) {
      return fail('FORBIDDEN', 'Hanya leader yang dapat mengatur timer.');
    }
    if (pod.phase === 'COMPLETED') {
      return fail('INVALID_STATE', 'Sprint sudah selesai.');
    }

    const t = this.now();
    const action = parsed.data.action;

    if (action === 'PAUSE') {
      if ((pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') || pod.phaseEndsAt === null) {
        return fail('INVALID_STATE', 'Timer tidak sedang berjalan.');
      }
      this.accrueFocusSeconds(pod, t);
      pod.pausedRemainingMs = Math.max(0, pod.phaseEndsAt - t);
      pod.phaseEndsAt = null;
      pod.focusSegmentStartedAt = null;
      this.store.clearPhaseTimer(pod.podId);
    } else if (action === 'RESUME') {
      if ((pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') || pod.pausedRemainingMs === null) {
        return fail('INVALID_STATE', 'Timer tidak dalam status jeda.');
      }
      pod.phaseEndsAt = t + pod.pausedRemainingMs;
      pod.pausedRemainingMs = null;
      if (pod.phase === 'FOCUS') {
        pod.focusSegmentStartedAt = t;
      }
      this.schedulePhaseTransition(pod.podId);
    } else if (action === 'SKIP') {
      if (pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') {
        return fail('INVALID_STATE', 'Fase tidak bisa dilewati sekarang.');
      }
      this.store.clearPhaseTimer(pod.podId);
      this.advancePhase(pod.podId);
      return ok(this.toSnapshot(pod));
    } else if (action === 'END') {
      this.accrueFocusSeconds(pod, t);
      this.store.clearPhaseTimer(pod.podId);
      pod.phase = 'COMPLETED';
      pod.phaseEndsAt = null;
      pod.pausedRemainingMs = null;
      pod.focusSegmentStartedAt = null;
      if (this.activeJoinedPodId === pod.podId) {
        this.activeJoinedPodId = null;
      }
    }

    this.persistNow();
    const snapshot = this.toSnapshot(pod);
    this.store.broadcast('pod:state', snapshot);
    return ok(snapshot);
  }

  public async presenceSet(payload: PresenceSetPayload): Promise<Ack<{ updated: true }>> {
    const parsed = presenceSetPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Status kehadiran tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === this.getCurrentUserId());
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    if (member.status === parsed.data.status) {
      return ok({ updated: true });
    }
    member.status = parsed.data.status;
    this.persistNow();
    this.store.broadcast('presence:update', { userId: member.userId, status: member.status });
    return ok({ updated: true });
  }

  public async queueAdd(payload: QueueAddPayload): Promise<Ack<QuestionDTO>> {
    const parsed = queueAddPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Teks pertanyaan harus 1 sampai 280 karakter.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === this.getCurrentUserId());
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    // D14: One question per member per pod, ever (resolved questions still occupy slot)
    const alreadyExists = pod.questions.some((q) => q.authorId === this.getCurrentUserId());
    if (alreadyExists) {
      return fail('QUESTION_LIMIT', COPY.errors.questionLimit);
    }

    const question: QuestionDTO = {
      id: this.store.nextQuestionId(pod.podId),
      podId: pod.podId,
      authorId: this.getCurrentUserId(),
      authorName: this.currentUser.name,
      text: parsed.data.text,
      aiHint: null,
      resolved: false,
      createdAt: this.now(),
    };

    pod.questions.push(question);
    this.persistNow();
    this.store.broadcast('queue:update', { questions: this.toSnapshot(pod).questions });
    return ok({ ...question });
  }

  public async queueResolve(payload: QueueResolvePayload): Promise<Ack<{ resolved: true }>> {
    const parsed = queueResolvePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Permintaan selesai tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const question = pod.questions.find((q) => q.id === parsed.data.questionId);
    if (!question) {
      return fail('VALIDATION_FAILED', 'Pertanyaan tidak ditemukan.');
    }
    const isAuthor = question.authorId === this.getCurrentUserId();
    const isLeader = pod.leaderId === this.getCurrentUserId();
    if (!isAuthor && !isLeader) {
      return fail('FORBIDDEN', 'Hanya penulis atau leader yang bisa menandai selesai.');
    }

    question.resolved = true;
    this.persistNow();
    this.store.broadcast('queue:update', { questions: this.toSnapshot(pod).questions });
    return ok({ resolved: true });
  }

  public async socraticAsk(payload: SocraticAskPayload): Promise<Ack<{ accepted: true }>> {
    const parsed = socraticAskPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Permintaan pemandu tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === this.getCurrentUserId());
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    const question = pod.questions.find((q) => q.id === parsed.data.questionId);
    if (!question) {
      return fail('VALIDATION_FAILED', 'Pertanyaan tidak ditemukan.');
    }

    // D5: Idempotent if aiHint is already generated
    if (question.aiHint) {
      this.store.broadcast('socratic:result', { questionId: question.id, hint: question.aiHint });
      return ok({ accepted: true });
    }

    // D5: Single-flight deduplication per questionId
    const key = `${pod.podId}:${question.id}`;
    const existingFlight = this.socraticInFlight.get(key);
    if (existingFlight) {
      return ok({ accepted: true });
    }

    const prevStatus = member.status;
    member.status = 'ASKING_GEMINI';
    this.store.broadcast('presence:update', { userId: member.userId, status: 'ASKING_GEMINI' });

    const flight = new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          if (this.store.failNextSocraticCode) {
            const code = this.store.failNextSocraticCode;
            this.store.failNextSocraticCode = undefined;
            this.store.broadcast('socratic:error', {
              questionId: question.id,
              code,
              retryAfterMs: 3000,
            });
            return;
          }

          const hint = buildDeterministicSocraticHint(question.text);
          question.aiHint = hint;
          this.persistNow();
          this.store.broadcast('socratic:result', { questionId: question.id, hint });
          this.store.broadcast('queue:update', { questions: this.toSnapshot(pod).questions });
        } finally {
          member.status = prevStatus === 'ASKING_GEMINI' ? 'IN_FOCUS' : prevStatus;
          this.persistNow();
          this.store.broadcast('presence:update', { userId: member.userId, status: member.status });
          this.socraticInFlight.delete(key);
          resolve();
        }
      }, this.geminiDelayMs);
    });

    this.socraticInFlight.set(key, flight);
    return ok({ accepted: true });
  }

  public async endorseGive(payload: EndorseGivePayload): Promise<Ack<{ endorsed: true }>> {
    const parsed = endorseGivePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Data apresiasi tidak valid.');
    }
    const pod = this.store.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.phase !== 'COMPLETED') {
      return fail('INVALID_STATE', 'Apresiasi hanya tersedia setelah sprint selesai.');
    }
    if (parsed.data.toUserId === this.getCurrentUserId()) {
      return fail('FORBIDDEN', 'Kamu tidak bisa memberi apresiasi ke diri sendiri.');
    }
    const targetExists = pod.members.some((m) => m.userId === parsed.data.toUserId);
    if (!targetExists) {
      return fail('NOT_A_MEMBER', 'Penerima bukan anggota pod ini.');
    }
    const endorseKey = `${this.getCurrentUserId()}->${parsed.data.toUserId}`;
    if (pod.endorsements.has(endorseKey)) {
      return fail('INVALID_STATE', 'Apresiasi sudah diberikan.');
    }
    pod.endorsements.add(endorseKey);
    return ok({ endorsed: true });
  }

  public getNotes(podId: string): string {
    return this.store.pods.get(podId)?.notes ?? '';
  }

  public updateNotes(podId: string, content: string): void {
    const pod = this.store.pods.get(podId);
    if (!pod || pod.notes === content) {
      return;
    }
    pod.notes = content;
    this.persistNow();
    const bucket = this.store.notesListeners.get(podId);
    if (bucket) {
      for (const listener of bucket) {
        listener(content);
      }
    }
  }

  public subscribeNotes(podId: string, listener: (content: string) => void): Unsubscribe {
    let bucket = this.store.notesListeners.get(podId);
    if (!bucket) {
      bucket = new Set();
      this.store.notesListeners.set(podId, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.store.notesListeners.delete(podId);
      }
    };
  }

  public dispose(): void {
    this.store.unregisterClient(this);
    if (!this.isExternalStore) {
      this.store.dispose();
    }
    this.clearAllMatchTimers();
    this.socraticInFlight.clear();
    this.connectionListeners.clear();
    for (const key of Object.keys(this.listeners) as (keyof EventMap)[]) {
      this.listeners[key].clear();
    }
  }
}
