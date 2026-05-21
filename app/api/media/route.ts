import { auth } from '@/lib/auth/config';
import { getDefaultTenant, getMediaByTenant } from '@/lib/db/queries';

export async function GET(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json([]);

  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type');
  const type =
    typeParam === 'image' || typeParam === 'logo' || typeParam === 'video' || typeParam === 'image-or-logo'
      ? typeParam
      : undefined;

  const rows = await getMediaByTenant(tenant.id, type);
  return Response.json(rows);
}
