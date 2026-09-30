import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { getPublishStatus } from '@/lib/publish';

/** GET /api/publish/status — what's on the screens vs. what's been edited. */
export async function GET() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });
  const status = await getPublishStatus(tenant.id);
  return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
