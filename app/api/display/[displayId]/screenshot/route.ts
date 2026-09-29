import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, displayEvents, tenants } from '@/lib/db/schema';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * POST /api/display/[displayId]/screenshot
 *
 * Raw image body (Content-Type: image/jpeg or image/png) from the Pi agent
 * after a 'screenshot' command. Stored in Vercel Blob at a fixed path per
 * display — overwritten each time, so a display never accumulates more
 * than one screenshot's worth of storage.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;
  const contentType = req.headers.get('content-type') ?? '';
  const isJpeg = contentType.startsWith('image/jpeg');
  const isPng = contentType.startsWith('image/png');
  if (!isJpeg && !isPng) {
    return Response.json({ error: 'Send image/jpeg or image/png' }, { status: 415 });
  }

  const display = await db.query.displays.findFirst({ where: eq(displays.id, displayId) });
  if (!display) return Response.json({ error: 'Unknown display' }, { status: 404 });

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) return Response.json({ error: 'Empty body' }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: `Screenshot over ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 });
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, display.tenantId) });
  const slug = tenant?.slug ?? 'tenant';
  const ext = isJpeg ? 'jpg' : 'png';

  try {
    const blob = await put(`${slug}/screens/${displayId}.${ext}`, Buffer.from(bytes), {
      access: 'public',
      contentType: isJpeg ? 'image/jpeg' : 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true,
      // Short cache: the URL is stable and the content changes.
      cacheControlMaxAge: 60,
    });
    const now = new Date();
    await db
      .update(displays)
      .set({ screenshotUrl: blob.url, screenshotAt: now })
      .where(eq(displays.id, displayId));
    await db.insert(displayEvents).values({
      tenantId: display.tenantId,
      displayId,
      kind: 'screenshot',
      at: now,
      meta: { bytes: bytes.byteLength },
    });
    return Response.json({ ok: true, url: blob.url }, { headers: NO_STORE });
  } catch (err) {
    console.error('[screenshot] upload failed', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
