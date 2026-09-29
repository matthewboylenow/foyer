import { db } from '@/lib/db/client';
import { displays, displayEvents } from '@/lib/db/schema';
import type { AgentInfo } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/display/[displayId]/agent
 *
 * The Raspberry Pi agent (public/pi/foyer-agent.sh) checks in here every
 * minute with the device's vitals and picks up at most one queued command.
 *
 * Body: AgentInfo (all fields optional).
 * Reply: { ok: true, command: 'reboot' | 'reload' | 'screenshot' | 'update' | null }
 *
 * Same trust model as the heartbeat: the display UUID is the credential.
 * The command is cleared the moment it is handed out, so a flaky network
 * can't replay a reboot.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;
  const now = new Date();

  let info: AgentInfo = {};
  try {
    const body = (await req.json()) as Record<string, unknown>;
    info = sanitize(body);
  } catch {
    // Empty or malformed body — still counts as a check-in.
  }

  const existing = await db.query.displays.findFirst({ where: eq(displays.id, displayId) });
  if (!existing) return Response.json({ error: 'Unknown display' }, { status: 404 });

  const command = existing.pendingCommand ?? null;
  const firstCheckIn = !existing.agentLastSeenAt;

  await db
    .update(displays)
    .set({
      agentLastSeenAt: now,
      agentInfo: info,
      hardware: 'pi',
      ...(command ? { pendingCommand: null, pendingCommandAt: null, pendingCommandBy: null } : {}),
    })
    .where(eq(displays.id, displayId));

  if (firstCheckIn) {
    await db.insert(displayEvents).values({
      tenantId: existing.tenantId,
      displayId,
      kind: 'agent_installed',
      at: now,
      meta: { hostname: info.hostname ?? null, model: info.model ?? null },
    });
  }

  return Response.json({ ok: true, command }, { headers: NO_STORE });
}

/** Keep only known keys, coerce types, and cap string lengths. */
function sanitize(body: Record<string, unknown>): AgentInfo {
  const str = (k: string, max = 120) =>
    typeof body[k] === 'string' ? (body[k] as string).slice(0, max) : undefined;
  const num = (k: string) => {
    const v = body[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return undefined;
  };
  const bool = (k: string) => {
    const v = body[k];
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === 1 || v === '1') return true;
    if (v === 'false' || v === 0 || v === '0') return false;
    return undefined;
  };
  const out: AgentInfo = {
    agentVersion: str('agentVersion', 32),
    hostname: str('hostname'),
    ip: str('ip', 64),
    model: str('model'),
    os: str('os'),
    uptimeSec: num('uptimeSec'),
    cpuTempC: num('cpuTempC'),
    memUsedPct: num('memUsedPct'),
    diskUsedPct: num('diskUsedPct'),
    chromiumRunning: bool('chromiumRunning'),
    throttled: str('throttled', 32),
  };
  // Drop undefined keys so the jsonb stays tidy.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as AgentInfo;
}
