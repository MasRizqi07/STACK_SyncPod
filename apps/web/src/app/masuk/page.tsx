import { redirect } from 'next/navigation';
import { COPY } from '@/copy';
import { MasukCard } from '@/components/auth';
import { auth } from '@/auth';
import { getEnv } from '@/env';

export const dynamic = 'force-dynamic';

interface MasukPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function MasukPage({ searchParams }: MasukPageProps) {
  // D38 defense-in-depth: redirect authenticated users to /pod in real mode
  if (process.env.NEXT_PUBLIC_REALTIME_MODE === 'real') {
    const session = await auth();
    if (session?.user?.id) {
      redirect('/pod');
    }
  }

  const params = await searchParams;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const initialError = rawError === 'AccessDenied' ? COPY.auth.domainRejected : null;
  const demoModeEnabled = getEnv().DEMO_MODE === 'true';

  return <MasukCard demoModeEnabled={demoModeEnabled} initialError={initialError} />;
}
