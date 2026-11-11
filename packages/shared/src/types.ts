export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_A_MEMBER'
  | 'POD_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'ALREADY_MATCHING'
  | 'ALREADY_IN_POD'
  | 'QUESTION_LIMIT'
  | 'RATE_LIMITED'
  | 'GEMINI_UNAVAILABLE'
  | 'GUARDRAIL_BLOCKED'
  | 'INVALID_STATE';

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export type Urgency = 'QUIZ_PREP' | 'STUCK_ASSIGNMENT' | 'THEORY_REVIEW';
export type PodPhase = 'LOBBY' | 'FOCUS' | 'BREAK' | 'COMPLETED';
export type PodRole = 'LEADER' | 'MEMBER';
export type PresenceStatus = 'IN_FOCUS' | 'TAKING_NOTES' | 'ASKING_GEMINI' | 'DISCONNECTED';
export type ClientPresenceStatus = 'IN_FOCUS' | 'TAKING_NOTES';
export type TimerAction = 'PAUSE' | 'RESUME' | 'SKIP' | 'END';

export interface SocraticHint {
  concept: string;
  guidingQuestions: [string, string, string];
  analogy: string;
  docHint?: {
    source: string;
    searchFor: string;
  };
}

export interface QuestionDTO {
  id: string;
  podId: string;
  authorId: string;
  authorName: string;
  text: string;
  aiHint: SocraticHint | null;
  resolved: boolean;
  createdAt: number;
}

export interface PodMemberDTO {
  userId: string;
  name: string;
  universityName?: string;
  role: PodRole;
  status: PresenceStatus;
  isSimulated?: boolean;
  focusedSec?: number;
}

export interface PodSnapshot {
  podId: string;
  module: {
    id: string;
    title: string;
    path: string[];
  };
  phase: PodPhase;
  round: number;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  phaseDurationSec: number;
  serverNow: number;
  leaderId: string;
  members: PodMemberDTO[];
  questions: QuestionDTO[];
}

export interface TimePingPayload {
  t0: number;
}

export interface TimePingResult {
  t0: number;
  serverNow: number;
}

export interface MatchEnqueuePayload {
  moduleId: string;
  urgency: Urgency;
  windowStart: number;
  windowEnd: number;
}

export interface MatchEnqueueResult {
  requestId: string;
}

export type MatchCancelPayload = Record<string, never>;

export type MatchFallbackReplyPayload =
  | { offerId: string; accept: boolean }
  | { offerId: string; extend: true };

export interface PodIdPayload {
  podId: string;
}

export interface TimerControlPayload {
  podId: string;
  action: TimerAction;
}

export interface PresenceSetPayload {
  podId: string;
  status: ClientPresenceStatus;
}

export interface QueueAddPayload {
  podId: string;
  text: string;
}

export interface QueueResolvePayload {
  podId: string;
  questionId: string;
}

export interface SocraticAskPayload {
  podId: string;
  questionId: string;
}

export interface EndorseGivePayload {
  podId: string;
  toUserId: string;
}

export interface MatchUpdateEvent {
  waitingCount: number;
  seats: number;
}

export interface MatchFoundEvent {
  podId: string;
}

export interface MatchFallbackOfferEvent {
  offerId: string;
  count: 3;
  expiresAt: number;
}

export interface PresenceUpdateEvent {
  userId: string;
  status: PresenceStatus;
}

export interface QueueUpdateEvent {
  questions: QuestionDTO[];
}

export interface SocraticResultEvent {
  questionId: string;
  hint: SocraticHint;
}

export interface SocraticErrorEvent {
  questionId: string;
  code: ErrorCode;
  retryAfterMs?: number;
}

export interface ClientToServerEvents {
  'time:ping': (payload: TimePingPayload, ack: (res: Ack<TimePingResult>) => void) => void;
  'match:enqueue': (payload: MatchEnqueuePayload, ack: (res: Ack<MatchEnqueueResult>) => void) => void;
  'match:cancel': (payload: MatchCancelPayload, ack: (res: Ack<{ cancelled: true }>) => void) => void;
  'match:fallback-reply': (
    payload: MatchFallbackReplyPayload,
    ack: (res: Ack<{ accepted: boolean }>) => void,
  ) => void;
  'pod:join': (payload: PodIdPayload, ack: (res: Ack<PodSnapshot>) => void) => void;
  'pod:leave': (payload: PodIdPayload, ack: (res: Ack<{ left: true }>) => void) => void;
  'pod:start': (payload: PodIdPayload, ack: (res: Ack<PodSnapshot>) => void) => void;
  'timer:control': (payload: TimerControlPayload, ack: (res: Ack<PodSnapshot>) => void) => void;
  'presence:set': (payload: PresenceSetPayload, ack: (res: Ack<{ updated: true }>) => void) => void;
  'queue:add': (payload: QueueAddPayload, ack: (res: Ack<QuestionDTO>) => void) => void;
  'queue:resolve': (payload: QueueResolvePayload, ack: (res: Ack<{ resolved: true }>) => void) => void;
  'socratic:ask': (payload: SocraticAskPayload, ack: (res: Ack<{ accepted: true }>) => void) => void;
  'endorse:give': (payload: EndorseGivePayload, ack: (res: Ack<{ endorsed: true }>) => void) => void;
}

export interface ServerToClientEvents {
  'match:update': (payload: MatchUpdateEvent) => void;
  'match:found': (payload: MatchFoundEvent) => void;
  'match:fallback-offer': (payload: MatchFallbackOfferEvent) => void;
  'pod:state': (payload: PodSnapshot) => void;
  'presence:update': (payload: PresenceUpdateEvent) => void;
  'queue:update': (payload: QueueUpdateEvent) => void;
  'socratic:result': (payload: SocraticResultEvent) => void;
  'socratic:error': (payload: SocraticErrorEvent) => void;
}
