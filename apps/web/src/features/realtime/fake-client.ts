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
import {
  DEMO_BREAK_SECONDS,
  DEMO_CURRENT_USER,
  DEMO_FOCUS_SECONDS,
  DEMO_GEMINI_DELAY_MS,
  DEMO_INITIAL_NOTES,
  DEMO_MATCH_SCHEDULE_MS,
  DEMO_MAX_ROUNDS,
  DEMO_MODULE_DIJKSTRA,
  DEMO_SIMULATED_PEERS,
  buildDeterministicSocraticHint,
  createDemoSeedQuestion,
} from './constants';
import type { ConnectionState, RealtimeClient, Unsubscribe } from './types';

interface PodRecord {
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
  endorsements: Set<string>;
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

export interface FakeRealtimeClientOptions {
  now?: () => number;
  focusDurationSec?: number;
  breakDurationSec?: number;
  maxRounds?: number;
  geminiDelayMs?: number;
}

function fail<T>(code: ErrorCode, message: string): Ack<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): Ack<T> {
  return { ok: true, data };
}

export class FakeRealtimeClient implements RealtimeClient {
  private readonly now: () => number;
  private readonly focusDurationSec: number;
  private readonly breakDurationSec: number;
  private readonly maxRounds: number;
  private readonly geminiDelayMs: number;

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

  private readonly pods = new Map<string, PodRecord>();
  private readonly notesListeners = new Map<string, Set<(content: string) => void>>();
  private readonly activePhaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly matchTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly socraticInFlight = new Map<string, Promise<void>>();
  private activeMatchRequestId: string | null = null;
  private matchCounter = 0;
  private questionCounter = 1;

  constructor(options: FakeRealtimeClientOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.focusDurationSec = options.focusDurationSec ?? DEMO_FOCUS_SECONDS;
    this.breakDurationSec = options.breakDurationSec ?? DEMO_BREAK_SECONDS;
    this.maxRounds = options.maxRounds ?? DEMO_MAX_ROUNDS;
    this.geminiDelayMs = options.geminiDelayMs ?? DEMO_GEMINI_DELAY_MS;

    this.seedDefaultPod();
  }

  private seedDefaultPod(): void {
    const t = this.now();
    const members: PodMemberDTO[] = [
      {
        userId: DEMO_CURRENT_USER.userId,
        name: DEMO_CURRENT_USER.name,
        universityName: DEMO_CURRENT_USER.universityName,
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
      leaderId: DEMO_CURRENT_USER.userId,
      members,
      questions: [createDemoSeedQuestion('pod-042', t - 45_000)],
      notes: DEMO_INITIAL_NOTES,
      endorsements: new Set(),
    };

    this.pods.set(record.podId, record);
    this.schedulePhaseTransition(record.podId);
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
              guidingQuestions: [...q.aiHint.guidingQuestions] as [string, string, string],
              analogy: q.aiHint.analogy,
              ...(q.aiHint.docHint ? { docHint: { ...q.aiHint.docHint } } : {}),
            }
          : null,
      })),
    };
  }

  private emit<K extends keyof EventMap>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    const bucket = this.listeners[event] as Set<(...a: Parameters<ServerToClientEvents[K]>) => void>;
    for (const listener of bucket) {
      listener(...args);
    }
  }

  private clearPhaseTimer(podId: string): void {
    const existing = this.activePhaseTimers.get(podId);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.activePhaseTimers.delete(podId);
    }
  }

  private schedulePhaseTransition(podId: string): void {
    this.clearPhaseTimer(podId);
    const pod = this.pods.get(podId);
    if (!pod || pod.phaseEndsAt === null || pod.pausedRemainingMs !== null) {
      return;
    }
    if (pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') {
      return;
    }
    const delayMs = Math.max(0, pod.phaseEndsAt - this.now());
    const handle = setTimeout(() => {
      this.activePhaseTimers.delete(podId);
      this.advancePhase(podId);
    }, delayMs);
    this.activePhaseTimers.set(podId, handle);
  }

  private advancePhase(podId: string): void {
    const pod = this.pods.get(podId);
    if (!pod) return;

    const currentTime = this.now();

    if (pod.phase === 'FOCUS') {
      if (pod.round >= this.maxRounds) {
        pod.phase = 'COMPLETED';
        pod.phaseEndsAt = null;
        pod.pausedRemainingMs = null;
      } else {
        pod.phase = 'BREAK';
        pod.phaseDurationSec = pod.breakDurationSec;
        pod.phaseEndsAt = currentTime + pod.breakDurationSec * 1000;
        pod.pausedRemainingMs = null;
      }
    } else if (pod.phase === 'BREAK') {
      if (pod.round >= this.maxRounds) {
        pod.phase = 'COMPLETED';
        pod.phaseEndsAt = null;
        pod.pausedRemainingMs = null;
      } else {
        pod.phase = 'FOCUS';
        pod.round += 1;
        pod.phaseDurationSec = pod.focusDurationSec;
        pod.phaseEndsAt = currentTime + pod.focusDurationSec * 1000;
        pod.pausedRemainingMs = null;
      }
    }

    this.schedulePhaseTransition(podId);
    this.emit('pod:state', this.toSnapshot(pod));
  }

  public getCurrentUserId(): string {
    return DEMO_CURRENT_USER.userId;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
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
    if (this.activeMatchRequestId) {
      return fail('ALREADY_MATCHING', 'Kamu sedang mencari pod.');
    }

    this.matchCounter += 1;
    const requestId = `req-demo-${this.matchCounter}`;
    this.activeMatchRequestId = requestId;

    this.emit('match:update', { waitingCount: 1, seats: 1 });

    DEMO_MATCH_SCHEDULE_MS.forEach((delayMs, index) => {
      const seatCount = index + 2;
      const timer = setTimeout(() => {
        this.matchTimers.delete(timer);
        if (this.activeMatchRequestId !== requestId) {
          return;
        }
        this.emit('match:update', { waitingCount: seatCount, seats: seatCount });
        if (seatCount === 4) {
          this.activeMatchRequestId = null;
          this.emit('match:found', { podId: 'pod-042' });
        }
      }, delayMs);
      this.matchTimers.add(timer);
    });

    return ok({ requestId });
  }

  public async matchCancel(payload: MatchCancelPayload): Promise<Ack<{ cancelled: true }>> {
    const parsed = matchCancelPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Payload pembatalan tidak valid.');
    }
    this.activeMatchRequestId = null;
    for (const timer of this.matchTimers) {
      clearTimeout(timer);
    }
    this.matchTimers.clear();
    return ok({ cancelled: true });
  }

  public async matchFallbackReply(
    payload: MatchFallbackReplyPayload,
  ): Promise<Ack<{ accepted: boolean }>> {
    const parsed = matchFallbackReplyPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Balasan tawaran tidak valid.');
    }
    if ('accept' in parsed.data && parsed.data.accept) {
      this.emit('match:found', { podId: 'pod-042' });
      return ok({ accepted: true });
    }
    return ok({ accepted: false });
  }

  public async podJoin(payload: PodIdPayload): Promise<Ack<PodSnapshot>> {
    const parsed = podJoinPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === DEMO_CURRENT_USER.userId);
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    if (member.status === 'DISCONNECTED') {
      member.status = 'IN_FOCUS';
    }
    const snapshot = this.toSnapshot(pod);
    this.emit('pod:state', snapshot);
    return ok(snapshot);
  }

  public async podLeave(payload: PodIdPayload): Promise<Ack<{ left: true }>> {
    const parsed = podLeavePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === DEMO_CURRENT_USER.userId);
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    member.status = 'DISCONNECTED';
    this.emit('presence:update', { userId: member.userId, status: 'DISCONNECTED' });
    this.emit('pod:state', this.toSnapshot(pod));
    return ok({ left: true });
  }

  public async podStart(payload: PodIdPayload): Promise<Ack<PodSnapshot>> {
    const parsed = podStartPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Identitas pod tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.leaderId !== DEMO_CURRENT_USER.userId) {
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

    this.schedulePhaseTransition(pod.podId);
    const snapshot = this.toSnapshot(pod);
    this.emit('pod:state', snapshot);
    return ok(snapshot);
  }

  public async timerControl(payload: TimerControlPayload): Promise<Ack<PodSnapshot>> {
    const parsed = timerControlPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Kontrol timer tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.leaderId !== DEMO_CURRENT_USER.userId) {
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
      pod.pausedRemainingMs = Math.max(0, pod.phaseEndsAt - t);
      pod.phaseEndsAt = null;
      this.clearPhaseTimer(pod.podId);
    } else if (action === 'RESUME') {
      if ((pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') || pod.pausedRemainingMs === null) {
        return fail('INVALID_STATE', 'Timer tidak dalam status jeda.');
      }
      pod.phaseEndsAt = t + pod.pausedRemainingMs;
      pod.pausedRemainingMs = null;
      this.schedulePhaseTransition(pod.podId);
    } else if (action === 'SKIP') {
      if (pod.phase !== 'FOCUS' && pod.phase !== 'BREAK') {
        return fail('INVALID_STATE', 'Fase tidak bisa dilewati sekarang.');
      }
      this.clearPhaseTimer(pod.podId);
      this.advancePhase(pod.podId);
      return ok(this.toSnapshot(pod));
    } else if (action === 'END') {
      this.clearPhaseTimer(pod.podId);
      pod.phase = 'COMPLETED';
      pod.phaseEndsAt = null;
      pod.pausedRemainingMs = null;
    }

    const snapshot = this.toSnapshot(pod);
    this.emit('pod:state', snapshot);
    return ok(snapshot);
  }

  public async presenceSet(payload: PresenceSetPayload): Promise<Ack<{ updated: true }>> {
    const parsed = presenceSetPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Status kehadiran tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === DEMO_CURRENT_USER.userId);
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    if (member.status === parsed.data.status) {
      return ok({ updated: true });
    }
    member.status = parsed.data.status;
    this.emit('presence:update', { userId: member.userId, status: member.status });
    return ok({ updated: true });
  }

  public async queueAdd(payload: QueueAddPayload): Promise<Ack<QuestionDTO>> {
    const parsed = queueAddPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Teks pertanyaan harus 1 sampai 280 karakter.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === DEMO_CURRENT_USER.userId);
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    // D14: One question per member per pod, ever (resolved questions still occupy slot)
    const alreadyExists = pod.questions.some((q) => q.authorId === DEMO_CURRENT_USER.userId);
    if (alreadyExists) {
      return fail('QUESTION_LIMIT', 'Kamu sudah punya satu pertanyaan di pod ini.');
    }

    this.questionCounter += 1;
    const question: QuestionDTO = {
      id: `q-042-${this.questionCounter}`,
      podId: pod.podId,
      authorId: DEMO_CURRENT_USER.userId,
      authorName: DEMO_CURRENT_USER.name,
      text: parsed.data.text,
      aiHint: null,
      resolved: false,
      createdAt: this.now(),
    };

    pod.questions.push(question);
    this.emit('queue:update', { questions: this.toSnapshot(pod).questions });
    return ok({ ...question });
  }

  public async queueResolve(payload: QueueResolvePayload): Promise<Ack<{ resolved: true }>> {
    const parsed = queueResolvePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Permintaan selesai tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const question = pod.questions.find((q) => q.id === parsed.data.questionId);
    if (!question) {
      return fail('VALIDATION_FAILED', 'Pertanyaan tidak ditemukan.');
    }
    const isAuthor = question.authorId === DEMO_CURRENT_USER.userId;
    const isLeader = pod.leaderId === DEMO_CURRENT_USER.userId;
    if (!isAuthor && !isLeader) {
      return fail('FORBIDDEN', 'Hanya penulis atau leader yang bisa menandai selesai.');
    }

    question.resolved = true;
    this.emit('queue:update', { questions: this.toSnapshot(pod).questions });
    return ok({ resolved: true });
  }

  public async socraticAsk(payload: SocraticAskPayload): Promise<Ack<{ accepted: true }>> {
    const parsed = socraticAskPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', 'Permintaan pemandu tidak valid.');
    }
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    const member = pod.members.find((m) => m.userId === DEMO_CURRENT_USER.userId);
    if (!member) {
      return fail('NOT_A_MEMBER', 'Kamu bukan anggota pod ini.');
    }
    const question = pod.questions.find((q) => q.id === parsed.data.questionId);
    if (!question) {
      return fail('VALIDATION_FAILED', 'Pertanyaan tidak ditemukan.');
    }

    // D5: Idempotent if aiHint is already generated
    if (question.aiHint) {
      this.emit('socratic:result', { questionId: question.id, hint: question.aiHint });
      return ok({ accepted: true });
    }

    // D5: Single-flight deduplication per questionId
    const key = `${pod.podId}:${question.id}`;
    const existingFlight = this.socraticInFlight.get(key);
    if (existingFlight) {
      void existingFlight;
      return ok({ accepted: true });
    }

    const prevStatus = member.status;
    member.status = 'ASKING_GEMINI';
    this.emit('presence:update', { userId: member.userId, status: 'ASKING_GEMINI' });

    const flight = new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          const hint = buildDeterministicSocraticHint(question.text);
          question.aiHint = hint;
          this.emit('socratic:result', { questionId: question.id, hint });
          this.emit('queue:update', { questions: this.toSnapshot(pod).questions });
        } finally {
          member.status = prevStatus === 'ASKING_GEMINI' ? 'IN_FOCUS' : prevStatus;
          this.emit('presence:update', { userId: member.userId, status: member.status });
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
    const pod = this.pods.get(parsed.data.podId);
    if (!pod) {
      return fail('POD_NOT_FOUND', 'Pod tidak ditemukan.');
    }
    if (pod.phase !== 'COMPLETED') {
      return fail('INVALID_STATE', 'Apresiasi hanya tersedia setelah sprint selesai.');
    }
    if (parsed.data.toUserId === DEMO_CURRENT_USER.userId) {
      return fail('FORBIDDEN', 'Kamu tidak bisa memberi apresiasi ke diri sendiri.');
    }
    const targetExists = pod.members.some((m) => m.userId === parsed.data.toUserId);
    if (!targetExists) {
      return fail('NOT_A_MEMBER', 'Penerima bukan anggota pod ini.');
    }
    pod.endorsements.add(parsed.data.toUserId);
    return ok({ endorsed: true });
  }

  public getNotes(podId: string): string {
    return this.pods.get(podId)?.notes ?? '';
  }

  public updateNotes(podId: string, content: string): void {
    const pod = this.pods.get(podId);
    if (!pod || pod.notes === content) {
      return;
    }
    pod.notes = content;
    const bucket = this.notesListeners.get(podId);
    if (bucket) {
      for (const listener of bucket) {
        listener(content);
      }
    }
  }

  public subscribeNotes(podId: string, listener: (content: string) => void): Unsubscribe {
    let bucket = this.notesListeners.get(podId);
    if (!bucket) {
      bucket = new Set();
      this.notesListeners.set(podId, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.notesListeners.delete(podId);
      }
    };
  }

  public dispose(): void {
    for (const timer of this.activePhaseTimers.values()) {
      clearTimeout(timer);
    }
    this.activePhaseTimers.clear();
    for (const timer of this.matchTimers) {
      clearTimeout(timer);
    }
    this.matchTimers.clear();
    this.socraticInFlight.clear();
    this.connectionListeners.clear();
    this.notesListeners.clear();
    for (const key of Object.keys(this.listeners) as (keyof EventMap)[]) {
      this.listeners[key].clear();
    }
  }
}

