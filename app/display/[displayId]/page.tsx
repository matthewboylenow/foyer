import { Player } from '@/components/player/Player';
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
      <Player displayId={displayId} />
    </TenantTheme>
  );
}
