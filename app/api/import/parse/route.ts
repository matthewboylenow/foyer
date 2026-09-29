import { auth } from '@/lib/auth/config';
import { htmlToText } from '@/lib/import/html-to-text';
import { parseEmailText } from '@/lib/import/parse-email';

export const maxDuration = 120;

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/import/parse   Body: { source: string }
 *
 * Takes pasted email source (HubSpot HTML or plain text), reduces it to
 * structured text, and asks Claude to split it into slide proposals with
 * the copy preserved verbatim. Nothing is saved — the admin reviews the
 * proposals and calls /api/import/create.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { source?: unknown };
  const source = typeof body.source === 'string' ? body.source : '';
  if (!source.trim()) return Response.json({ error: 'Paste the email first.' }, { status: 400 });
  if (source.length > MAX_SOURCE_BYTES) {
    return Response.json({ error: 'That paste is too large.' }, { status: 413 });
  }

  const text = htmlToText(source);
  if (text.length < 40) {
    return Response.json({ error: 'Nothing readable in that paste.' }, { status: 400 });
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  });

  try {
    const result = await parseEmailText(text, today);
    return Response.json(
      { items: result.items, textLength: text.length, usage: result.usage, model: result.model },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[import/parse]', err);
    const message = err instanceof Error ? err.message : 'Parsing failed';
    return Response.json({ error: message }, { status: 502 });
  }
}
