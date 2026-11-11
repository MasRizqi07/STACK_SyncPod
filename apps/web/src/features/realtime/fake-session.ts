import { FakeRealtimeClient, type PersistedFakeState } from './fake-client';

const FAKE_AUTH_STORAGE_KEY = 'syncpod:fake-auth:v1';
const FAKE_STATE_STORAGE_KEY = 'syncpod:fake-state:v1';

let sharedClient: FakeRealtimeClient | null = null;
let fakeAuthenticatedInMemory = false;

export function setFakeSessionAuthenticated(authenticated: boolean): void {
  fakeAuthenticatedInMemory = authenticated;
  if (typeof window === 'undefined') return;
  try {
    if (authenticated) {
      window.sessionStorage.setItem(FAKE_AUTH_STORAGE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(FAKE_AUTH_STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable (e.g. restricted storage)
  }
}

export function isFakeSessionAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    return fakeAuthenticatedInMemory;
  }
  try {
    return (
      fakeAuthenticatedInMemory || window.sessionStorage.getItem(FAKE_AUTH_STORAGE_KEY) === '1'
    );
  } catch {
    return fakeAuthenticatedInMemory;
  }
}

function readPersistedFakeState(): PersistedFakeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FAKE_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('pod' in parsed) ||
      typeof (parsed as { pod?: unknown }).pod !== 'object'
    ) {
      return null;
    }
    return parsed as PersistedFakeState;
  } catch {
    return null;
  }
}

function writePersistedFakeState(state: PersistedFakeState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FAKE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/privacy errors
  }
}

export function getSharedFakeRealtimeClient(): FakeRealtimeClient {
  if (!sharedClient) {
    const client = new FakeRealtimeClient({
      onStatePersist: writePersistedFakeState,
    });
    const saved = readPersistedFakeState();
    if (saved) {
      client.importState(saved);
    }
    sharedClient = client;
  }
  return sharedClient;
}
