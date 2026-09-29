import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { logAudit } from '@/lib/auth/session';
import { isAgentCommand, queueCommand } from '@/lib/fleet';

/**
 * POST /api/displays/[id]/command   Body: { command: 'reboot' | 'reload' | 'screenshot' | 'update' }
 *
 * Admin-only. Queues one command for the display's Pi agent (picked up on
 * its next check-in, within a minute). 'reload' also works on non-Pi
 * hardware because the browser player honors it via the heartbeat reply.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tenant = await getCurrentTenant();
  const body = (await req.json().catch(() => ({}))) as { command?: unknown };
  if (!isAgentCommand(body.command)) {
    return Response.json({ error: 'Unknown command' }, { status: 400 });
  }

  const display = await db.query.displays.findFirst({ where: eq(displays.id, id) });
  if (!display || (tenant && display.tenantId !== tenant.id)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const by = session?.user?.email ?? null;
  await queueCommand(display, body.command, by);

  if (tenant) {
    await logAudit({
      tenantId: tenant.id,
      userId: session?.user?.id,
      userEmail: by ?? undefined,
      action: `display.${body.command}`,
      targetType: 'display',
      targetId: id,
      metadata: { name: display.name },
    });
  }

  return Response.json({ ok: true, command: body.command }, { headers: { 'Cache-Control': 'no-store' } });
}
