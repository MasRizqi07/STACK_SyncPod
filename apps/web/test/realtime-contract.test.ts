import { afterEach, vi } from 'vitest';
import {
  DEMO_CURRENT_USER,
  DEMO_SIMULATED_PEERS,
  FakeRealtimeClient,
  FakeWorldStore,
} from '../src/features/realtime';
import { runRealtimeClientContract } from './realtime-contract';

afterEach(() => {
  vi.useRealTimers();
});

runRealtimeClientContract('FakeRealtimeClient', {
  createHarness: ({ scenario = 'happy' } = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));

    const store = new FakeWorldStore();
    const peerMember = DEMO_SIMULATED_PEERS[0]!;
    const leaderClient = new FakeRealtimeClient({
      store,
      user: DEMO_CURRENT_USER,
      scenario,
    });
    const memberClient = new FakeRealtimeClient({
      store,
      user: {
        userId: peerMember.userId,
        name: peerMember.name,
        universityName: peerMember.universityName ?? 'ITATS',
      },
      scenario,
    });
    const outsiderClient = new FakeRealtimeClient({
      store,
      user: {
        userId: 'user-outsider',
        name: 'Pengguna Luar',
        universityName: 'ITATS',
      },
      scenario,
    });

    return {
      leaderClient,
      memberClient,
      outsiderClient,
      simulateNextSocraticError: (code = 'GEMINI_UNAVAILABLE') => {
        store.failNextSocraticCode = code;
      },
      advanceTimeMs: async (ms) => {
        await vi.advanceTimersByTimeAsync(ms);
      },
      dispose: () => {
        leaderClient.dispose();
        memberClient.dispose();
        outsiderClient.dispose();
        store.dispose();
      },
    };
  },
});

