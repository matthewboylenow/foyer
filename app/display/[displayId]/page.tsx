import { Player } from '@/components/player/Player';

export const dynamic = 'force-dynamic';

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;
  return <Player displayId={displayId} />;
}
