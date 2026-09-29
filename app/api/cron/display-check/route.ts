import { runDisplayCheck } from '@/lib/fleet';

/**
 * GET /api/cron/display-check
 *
 * Runs every 5 minutes (see vercel.json). Opens outage records for
 * displays that have gone quiet and sends the "screen down" email once the
 * tenant's alert threshold has passed. Recovery emails are sent by the
 * heartbeat route the moment a display comes back.
 *
 * Authorization: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Any external pinger (UptimeKuma, a Pi, cron-job.org) can drive this
 * instead by sending the same header — useful on the Hobby plan, where
 * Vercel crons only run once a day.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get('authorization') ?? '';
    if (header !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  }

  try {
    const result = await runDisplayCheck();
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[cron/display-check]', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
