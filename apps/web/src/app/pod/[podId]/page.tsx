import { CockpitShell } from '@/components/cockpit';

interface PodPageProps {
  params: Promise<{ podId: string }>;
}

export default async function PodPage({ params }: PodPageProps) {
  const { podId } = await params;
  return <CockpitShell podId={podId} />;
}

