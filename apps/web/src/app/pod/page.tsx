import { MatchmakingShell } from '@/components/matchmaking';

export const dynamic = 'force-dynamic';

export default function MatchmakingPage() {
  const demoModeEnabled = process.env.DEMO_MODE === 'true';
  return <MatchmakingShell demoModeEnabled={demoModeEnabled} />;
}
