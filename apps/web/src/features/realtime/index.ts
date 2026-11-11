export { getRealtimeMode, type RealtimeMode } from './config';
export {
  CLOCK_RECALIBRATE_MS,
  CLOCK_SAMPLE_COUNT,
  LAST_MINUTE_THRESHOLD_MS,
  TIMER_RENDER_INTERVAL_MS,
  computeClockSample,
  computeCorrectedNowMs,
  computeCountdownMs,
  computeTimerProgress,
  formatCountdown,
  isLastSixtySeconds,
  selectBestClockSample,
  type ClockSample,
  type CountdownInput,
} from './clock';
export {
  DEMO_BREAK_SECONDS,
  DEMO_BOT_JOIN_STEP_MS,
  DEMO_CURRENT_USER,
  DEMO_FOCUS_SECONDS,
  DEMO_GEMINI_DELAY_MS,
  DEMO_INITIAL_NOTES,
  DEMO_MATCH_SCHEDULE_MS,
  DEMO_MAX_ROUNDS,
  DEMO_MODULE_DIJKSTRA,
  DEMO_SIMULATED_PEERS,
  TYPING_IDLE_RESET_MS,
  buildDeterministicSocraticHint,
  createDemoSeedQuestion,
} from './constants';
export { FakeRealtimeClient, type FakeRealtimeClientOptions } from './fake-client';
export type { ConnectionState, RealtimeClient, Unsubscribe } from './types';

