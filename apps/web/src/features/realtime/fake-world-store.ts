import type { ErrorCode, PodMemberDTO, QuestionDTO, ServerToClientEvents } from '@syncpod/shared';
import type { ModuleTreeNode } from '@/features/matchmaking';

export interface PodRecord {
  podId: string;
  module: { id: string; title: string; path: string[] };
  phase: 'LOBBY' | 'FOCUS' | 'BREAK' | 'COMPLETED';
  round: number;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  phaseDurationSec: number;
  focusDurationSec: number;
  breakDurationSec: number;
  focusSegmentStartedAt: number | null;
  leaderId: string;
  members: PodMemberDTO[];
  questions: QuestionDTO[];
  notes: string;
  endorsements: Set<string>;
}

export interface ActiveOffer {
  offerId: string;
  requestId: string;
  module: ModuleTreeNode;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface FakeStoreClient {
  emitLocal<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void;
}

export class FakeWorldStore {
  public failNextSocraticCode?: Extract<ErrorCode, 'GEMINI_UNAVAILABLE' | 'GUARDRAIL_BLOCKED'>;
  public readonly pods = new Map<string, PodRecord>();
  public readonly clients = new Set<FakeStoreClient>();
  public readonly notesListeners = new Map<string, Set<(content: string) => void>>();
  public readonly activePhaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private questionCounter = 1;

  public resetQuestionCounter(val = 1): void {
    this.questionCounter = val;
  }

  public getQuestionCounter(): number {
    return this.questionCounter;
  }

  public nextQuestionId(podId: string): string {
    this.questionCounter += 1;
    const cleanId = podId.startsWith('pod-') ? podId.slice(4) : podId;
    return `q-${cleanId}-${this.questionCounter}`;
  }

  public registerClient(client: FakeStoreClient): void {
    this.clients.add(client);
  }

  public unregisterClient(client: FakeStoreClient): void {
    this.clients.delete(client);
  }

  public broadcast<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
  ): void {
    for (const client of this.clients) {
      client.emitLocal(event, payload);
    }
  }

  public clearPhaseTimer(podId: string): void {
    const timer = this.activePhaseTimers.get(podId);
    if (timer) {
      clearTimeout(timer);
      this.activePhaseTimers.delete(podId);
    }
  }

  public dispose(): void {
    for (const timer of this.activePhaseTimers.values()) {
      clearTimeout(timer);
    }
    this.activePhaseTimers.clear();
    this.clients.clear();
    this.pods.clear();
    this.notesListeners.clear();
    this.failNextSocraticCode = undefined;
  }
}
