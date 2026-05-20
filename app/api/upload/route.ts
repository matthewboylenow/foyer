import { put } from '@vercel/blob';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db/client';
import { media } from '@/lib/db/schema';
import { getDefaultTenant } from '@/lib/db/queries';

export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const type = (form.get('type') as string) ?? 'image';

  if (!file) return Response.json({ error: 'No file' }, { status: 400 });

  const blob = await put(file.name, file, { access: 'public' });

  const [row] = await db
    .insert(media)
    .values({
      tenantId: tenant.id,
      type: type as 'image' | 'logo',
      blobUrl: blob.url,
      filename: file.name,
      bytes: file.size,
      uploadedBy: session?.user?.email ?? null,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
