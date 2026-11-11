export type RealtimeMode = 'fake' | 'real';

export function getRealtimeMode(
  raw: string | undefined = process.env.NEXT_PUBLIC_REALTIME_MODE,
): RealtimeMode {
  return raw === 'fake' ? 'fake' : 'real';
}

