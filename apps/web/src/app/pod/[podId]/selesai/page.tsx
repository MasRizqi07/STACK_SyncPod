import { SummaryShell } from '@/components/summary';

interface PodSummaryPageProps {
  params: Promise<{ podId: string }>;
}

export default async function PodSummaryPage({ params }: PodSummaryPageProps) {
  const { podId } = await params;
  return <SummaryShell podId={podId} />;
}
