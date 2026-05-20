import { db } from '@/lib/db/client';
import { errors } from '@/lib/db/schema';
import { getDefaultTenant } from '@/lib/db/queries';

/**
 * POST /api/errors
 *
 * Body: { source, message, stack?, displayId?, slideId?, context? }
 *
 * Unauthenticated — called by the TV player (which is unauthenticated by
 * design), the admin (which posts client-side errors), and server code
 * (via reportServerError helper). Treated as best-effort: never throws,
 * never blocks the caller. A bad payload is logged and ignored.
 *
 * Note: we silently truncate very large stack/context fields so a flood
 * of huge errors can't bloat the row. Postgres can handle big text but
 * the admin list has to render them.
 */
const MAX_STACK = 4000;
const MAX_MESSAGE = 1000;

interface ErrorPayload {
  source?: string;
  message?: string;
  stack?: string;
  displayId?: string;
  slideId?: string;
  context?: Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ErrorPayload;
    const source = typeof body?.source === 'string' ? body.source.slice(0, 32) : 'unknown';
    const message =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message.slice(0, MAX_MESSAGE)
        : 'Empty error';
    const stack = typeof body?.stack === 'string' ? body.stack.slice(0, MAX_STACK) : null;
    const displayId = typeof body?.displayId === 'string' ? body.displayId : null;
    const slideId = typeof body?.slideId === 'string' ? body.slideId : null;
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    const tenant = await getDefaultTenant();

    await db.insert(errors).values({
      tenantId: tenant?.id ?? null,
      source,
      message,
      stack,
      displayId,
      slideId,
      context,
    });

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[errors] failed to persist error:', err);
    // Never propagate — error reporting must not itself error-loop.
    return Response.json({ ok: false }, { status: 200 });
  }
}
