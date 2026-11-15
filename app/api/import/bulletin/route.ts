import { auth } from '@/lib/auth/config';
import { readBulletin } from '@/lib/import/bulletin';

export const maxDuration = 60;

/**
 * POST /api/import/bulletin   Body: { url?: string; text?: string }, or multipart with a `pdf` file
 *
 * Reads the Mass intentions, Mass association and Sanctuary candle out of
 * the weekly bulletin PDF (the newest one on the parish site unless a URL
 * or already-extracted text is given). Nothing is saved; the "This week"
 * page fills its fields from the answer and the admin presses Save.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    let input: { url?: string | null; text?: string | null; pdf?: Uint8Array | null } = {};
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      // The admin can drop the PDF in when the site will not serve it to us.
      const form = await req.formData();
      const file = form.get('pdf');
      if (!(file instanceof File) || file.size === 0) return Response.json({ error: 'No PDF uploaded.' }, { status: 400 });
      if (file.size > 25 * 1024 * 1024) return Response.json({ error: 'That PDF is too large.' }, { status: 413 });
      input = { pdf: new Uint8Array(await file.arrayBuffer()) };
    } else {
      const body = (await req.json().catch(() => ({}))) as { url?: unknown; text?: unknown };
      input = { url: typeof body.url === 'string' ? body.url : null, text: typeof body.text === 'string' ? body.text : null };
    }
    const result = await readBulletin(input);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[import/bulletin]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Could not read the bulletin' }, { status: 502 });
  }
}
