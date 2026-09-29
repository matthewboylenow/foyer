import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { FONT_PAIRS } from '@/lib/fonts';
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('globalDurationSec' in body) update.globalDurationSec = body.globalDurationSec;
  if ('videoEnabled' in body) update.videoEnabled = body.videoEnabled;
  if ('missionStatement' in body) update.missionStatement = body.missionStatement;
  if ('logoMediaId' in body) update.logoMediaId = body.logoMediaId;
  // Per-tenant palette — accepted as hex strings, validated lightly.
  for (const key of ['primaryColor', 'accentColor', 'creamColor', 'goldColor'] as const) {
    if (key in body && typeof body[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(body[key])) {
      update[key] = body[key];
    }
  }
  // Per-tenant email "from" name + address.
  if ('emailFromName' in body) update.emailFromName = body.emailFromName;
  if ('emailFromAddress' in body) update.emailFromAddress = body.emailFromAddress;
  // Downtime alerts: recipients (free text, parsed at send time) and the
  // minutes a screen must be silent before the first email goes out.
  if ('alertEmails' in body) {
    update.alertEmails = typeof body.alertEmails === 'string' ? body.alertEmails.slice(0, 2000) : null;
  }
  if ('alertOfflineAfterMin' in body) {
    const n = Number(body.alertOfflineAfterMin);
    if (Number.isFinite(n)) update.alertOfflineAfterMin = Math.min(1440, Math.max(5, Math.round(n)));
  }
  // Per-tenant slide font pair. Validate against the curated list so an
  // attacker can't smuggle a third-party CSS URL into the picker.
  if ('fontPair' in body && typeof body.fontPair === 'string') {
    if (FONT_PAIRS.some((p) => p.id === body.fontPair)) {
      update.fontPair = body.fontPair;
    }
  }

  const [updated] = await db
    .update(settings)
    .set(update)
    .where(eq(settings.tenantId, tenant.id))
    .returning();

  return Response.json(updated);
}
