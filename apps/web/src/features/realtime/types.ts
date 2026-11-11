import type {
  Ack,
  EndorseGivePayload,
  MatchCancelPayload,
  MatchEnqueuePayload,
  MatchEnqueueResult,
  MatchFallbackReplyPayload,
  PodIdPayload,
  PodSnapshot,
  PresenceSetPayload,
  QuestionDTO,
  QueueAddPayload,
  QueueResolvePayload,
  ServerToClientEvents,
  SocraticAskPayload,
  TimePingPayload,
  TimePingResult,
  TimerControlPayload,
} from '@syncpod/shared';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export type Unsubscribe = () => void;

/**
 * Transport-agnostic realtime contract matching DESIGN.md B5 1:1.
 * Implemented by FakeRealtimeClient in Phase 2 and Socket.IO client in Phase 4.
 */
export interface RealtimeClient {
  timePing(payload: TimePingPayload): Promise<Ack<TimePingResult>>;
  matchEnqueue(payload: MatchEnqueuePayload): Promise<Ack<MatchEnqueueResult>>;
  matchCancel(payload: MatchCancelPayload): Promise<Ack<{ cancelled: true }>>;
  matchFallbackReply(payload: MatchFallbackReplyPayload): Promise<Ack<{ accepted: boolean }>>;
  podJoin(payload: PodIdPayload): Promise<Ack<PodSnapshot>>;
  podLeave(payload: PodIdPayload): Promise<Ack<{ left: true }>>;
  podStart(payload: PodIdPayload): Promise<Ack<PodSnapshot>>;
  timerControl(payload: TimerControlPayload): Promise<Ack<PodSnapshot>>;
  presenceSet(payload: PresenceSetPayload): Promise<Ack<{ updated: true }>>;
  queueAdd(payload: QueueAddPayload): Promise<Ack<QuestionDTO>>;
  queueResolve(payload: QueueResolvePayload): Promise<Ack<{ resolved: true }>>;
  socraticAsk(payload: SocraticAskPayload): Promise<Ack<{ accepted: true }>>;
  endorseGive(payload: EndorseGivePayload): Promise<Ack<{ endorsed: true }>>;

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ): Unsubscribe;

  getCurrentUserId(): string;
  getConnectionState(): ConnectionState;
  onConnectionStateChange(listener: (state: ConnectionState) => void): Unsubscribe;

  // Local shared-notes adapter used before Yjs is wired in Phase 6.
  getNotes(podId: string): string;
  updateNotes(podId: string, content: string): void;
  subscribeNotes(podId: string, listener: (content: string) => void): Unsubscribe;

  dispose(): void;
}

