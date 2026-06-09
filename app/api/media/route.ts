import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { media } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { getMediaByTenant } from '@/lib/db/queries';

export async function GET(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
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

/**
 * Register a media row after a client-side Vercel Blob upload completes.
 * The blobUrl must come from our own store — we don't accept arbitrary URLs
 * (that would let an attacker insert references to anything they like).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json()) as {
    blobUrl?: string;
    posterUrl?: string | null;
    filename?: string;
    bytes?: number;
    type?: 'image' | 'logo' | 'video';
  };

  if (!body.blobUrl || !body.filename || !body.type) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!body.blobUrl.includes('.public.blob.vercel-storage.com')) {
    return Response.json({ error: 'Bad blob URL' }, { status: 400 });
  }
  // Poster is optional (videos only) and must live in our store like blobUrl.
  if (body.posterUrl && !body.posterUrl.includes('.public.blob.vercel-storage.com')) {
    return Response.json({ error: 'Bad poster URL' }, { status: 400 });
  }
  if (body.type !== 'image' && body.type !== 'logo' && body.type !== 'video') {
    return Response.json({ error: 'Bad type' }, { status: 400 });
  }

  const [row] = await db
    .insert(media)
    .values({
      tenantId: tenant.id,
      type: body.type,
      blobUrl: body.blobUrl,
      posterUrl: body.type === 'video' ? (body.posterUrl ?? null) : null,
      filename: body.filename,
      bytes: body.bytes ?? null,
      uploadedBy: session?.user?.email ?? null,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
