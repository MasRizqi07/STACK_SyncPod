import { COPY } from '@/copy';
import { MasukCard } from '@/components/auth';

export const dynamic = 'force-dynamic';

interface MasukPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const params = await searchParams;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const initialError = rawError === 'AccessDenied' ? COPY.auth.domainRejected : null;
  const demoModeEnabled = process.env.DEMO_MODE === 'true';

  return <MasukCard demoModeEnabled={demoModeEnabled} initialError={initialError} />;
}
