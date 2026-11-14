import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { createEmailSlides, type CreateOptions } from '@/lib/import/create-slides';

/**
 * POST /api/import/create
 *
 * Creates one General slide per reviewed item inside a new collection,
 * optionally deactivating every slide from earlier "Email blast"
 * collections so the screens roll over to this week's set in one step.
 * The work itself lives in lib/import/create-slides.ts, shared with the
 * MCP `create_email_slides` tool.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Partial<CreateOptions>;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: 'No slides to create.' }, { status: 400 });
  }

  try {
    const result = await createEmailSlides(
      tenant.id,
      { ...body, items: body.items },
      { userId: session?.user?.id, email: session?.user?.email ?? null, label: 'admin' },
    );
    return Response.json(
      {
        ok: true,
        collectionId: result.collectionId,
        collectionName: result.collectionName,
        created: result.created.length,
        deactivated: result.deactivated,
        published: result.published,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create slides';
    const status = message === 'No slides to create.' ? 400 : 500;
    if (status === 500) console.error('[import/create]', err);
    return Response.json({ error: message }, { status });
  }
}
