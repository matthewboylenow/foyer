import { Player } from '@/components/player/Player';
import { PlayerBoundary } from '@/components/player/PlayerBoundary';
import { TenantTheme } from '@/components/TenantTheme';

export const dynamic = 'force-dynamic';

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;
  return (
    <TenantTheme>
      <PlayerBoundary displayId={displayId}>
        <Player displayId={displayId} />
      </PlayerBoundary>
    </TenantTheme>
  );
}
