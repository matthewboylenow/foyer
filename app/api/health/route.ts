import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * For an uptime monitor (UptimeKuma, Better Stack, a Pi cron): 200 when
 * the app and its database answer, 503 otherwise. No auth, no secrets,
 * one trivial query. Note the player itself keeps running on its cached
 * playlist when this is red; this is about the admin and new content.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { ok: true, db: 'ok', dbMs: Date.now() - started, at: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return Response.json(
      { ok: false, db: 'unreachable', error: err instanceof Error ? err.message : String(err) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
