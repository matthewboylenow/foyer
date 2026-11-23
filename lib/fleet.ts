import { and, count, desc, eq, gte, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, displayEvents, errors, playlistSnapshots, settings, slides, tenants } from '@/lib/db/schema';
import type { AgentCommand, Display, DisplayEvent, Settings } from '@/lib/db/schema';
import {
  formatDuration,
  isQuietHour,
  offlineAfterSec,
  parseEmailList,
  type Outage,
} from '@/lib/monitoring';
import { getResend, resolveFromAddress } from '@/lib/email';

/**
 * Server-side fleet helpers: playlist versioning, outage bookkeeping,
 * command queueing, and downtime alert emails. The pure math lives in
 * lib/monitoring.ts; this file is the only place that touches the DB for
 * monitoring purposes.
 */

// ─── Playlist version ────────────────────────────────────────────────────────

/**
 * A cheap fingerprint of "what this display should be playing right now."
 * One SQL statement, no media resolution. It changes whenever:
 *   - any currently-eligible slide is created/updated/deleted/toggled,
 *   - a dated slide enters or leaves its window (the WHERE is time-based),
 *   - the display's orientation or active flag changes,
 *   - tenant settings change (logo, palette, fonts).
 * The player compares it on every heartbeat and refetches the full
 * playlist only when it differs, so the expensive query runs on change
 * instead of every 30 seconds.
 *
 * Targeting (`targetDisplays`) and per-orientation availability are not
 * part of the hash — a slide edit still bumps `updated_at`, so the only
 * cost is an occasional refetch that yields an identical playlist.
 */
/** Two players on one display heartbeat within seconds of each other; a
 *  short cache turns their version checks into one query. Per instance. */
const versionCache = new Map<string, { at: number; version: string | null }>();
const VERSION_CACHE_MS = 20_000;

export function invalidateVersionCache(): void {
  versionCache.clear();
}

export async function computePlaylistVersion(displayId: string): Promise<string | null> {
  const hit = versionCache.get(displayId);
  if (hit && Date.now() - hit.at < VERSION_CACHE_MS) return hit.version;
  const version = await computePlaylistVersionUncached(displayId);
  versionCache.set(displayId, { at: Date.now(), version });
  return version;
}

async function computePlaylistVersionUncached(displayId: string): Promise<string | null> {
  const now = new Date();
  // Snapshot term: the latest snapshot's id plus which of its slides are
  // inside their dates right now (so an expiry still bumps the version).
  // Empty when the tenant has never published, in which case the live
  // string_agg below carries the version instead.
  const snapshotTerm = sql<string>`coalesce((
    SELECT ps.id::text || '#' || coalesce((
      SELECT string_agg(e->>'id', ',' ORDER BY e->>'id')
      FROM jsonb_array_elements(ps.slides) e
      WHERE (e->>'active')::boolean
        AND (
          (e->>'scheduleType') <> 'dated'
          OR (
            ((e->>'startAt') IS NULL OR (e->>'startAt')::timestamptz <= now())
            AND ((e->>'endAt') IS NULL OR (e->>'endAt')::timestamptz >= now())
          )
        )
    ), '')
    FROM ${playlistSnapshots} ps
    WHERE ps.tenant_id = ${displays.tenantId}
    ORDER BY ps.published_at DESC
    LIMIT 1
  ), 'live:' || coalesce(string_agg(${slides.id}::text || ':' || ${slides.updatedAt}::text, ',' ORDER BY ${slides.id}), ''))`;
  const [row] = await db
    .select({
      version: sql<string>`md5(
        ${snapshotTerm}
        || '|' || ${displays.orientation} || '|' || ${displays.active}::text
        || '|' || coalesce(${settings.updatedAt}::text, '')
      )`,
    })
    .from(displays)
    .leftJoin(settings, eq(settings.tenantId, displays.tenantId))
    .leftJoin(
      slides,
      and(
        eq(slides.tenantId, displays.tenantId),
        eq(slides.active, true),
        or(
          eq(slides.scheduleType, 'evergreen'),
          and(
            eq(slides.scheduleType, 'dated'),
            or(isNull(slides.startAt), lte(slides.startAt, now)),
            or(isNull(slides.endAt), gte(slides.endAt, now)),
          ),
        ),
      ),
    )
    .where(eq(displays.id, displayId))
    .groupBy(displays.id, displays.tenantId, displays.orientation, displays.active, settings.updatedAt);
  return row?.version ?? null;
}

// ─── Outage bookkeeping ──────────────────────────────────────────────────────

/**
 * Called from anywhere that has a fresh display row (status endpoint, cron).
 * If the player has been silent past OFFLINE_AFTER_SEC and there's no open
 * outage, open one. Idempotent. Returns the display with `offlineSince`
 * reflecting the new state.
 */
export async function noteOfflineIfSilent(display: Display, now = new Date()): Promise<Display> {
  if (display.offlineSince) return display;
  if (!display.active) return display;
  const lastMs = display.lastHeartbeatAt ? new Date(display.lastHeartbeatAt).getTime() : null;
  // A display that has never heart-beat is "not set up yet", not an outage.
  if (lastMs === null) return display;
  if ((now.getTime() - lastMs) / 1000 <= offlineAfterSec(now)) return display;

  const since = new Date(lastMs);
  // Guard against a concurrent writer (cron + status request at once):
  // only claim the outage if offline_since is still null.
  const [updated] = await db
    .update(displays)
    .set({ offlineSince: since })
    .where(and(eq(displays.id, display.id), isNull(displays.offlineSince)))
    .returning();
  if (!updated) return display;

  await db.insert(displayEvents).values({
    tenantId: display.tenantId,
    displayId: display.id,
    kind: 'offline',
    at: since,
  });
  return updated;
}

/**
 * Called from the heartbeat route when a display with an open outage
 * checks in. Closes the outage and, if a "down" alert had gone out, sends
 * the matching "back" email. Fire-and-forget safe.
 */
export async function resolveOutage(display: Display, now = new Date()): Promise<void> {
  if (!display.offlineSince) return;

  const [open] = await db
    .select()
    .from(displayEvents)
    .where(
      and(
        eq(displayEvents.displayId, display.id),
        eq(displayEvents.kind, 'offline'),
        isNull(displayEvents.resolvedAt),
      ),
    )
    .orderBy(desc(displayEvents.at))
    .limit(1);

  await db
    .update(displays)
    .set({ offlineSince: null })
    .where(eq(displays.id, display.id));

  if (open) {
    await db
      .update(displayEvents)
      .set({ resolvedAt: now })
      .where(eq(displayEvents.id, open.id));
    if (open.alertedAt) {
      const downFor = (now.getTime() - new Date(open.at).getTime()) / 1000;
      await sendDisplayAlert(display, 'up', { downForSec: downFor }).catch((err) =>
        console.error('[fleet] recovery email failed', err),
      );
    }
  }
}

/** Outages overlapping the last `windowMs` (plus any still open). */
export async function getOutages(displayId: string, windowMs: number, now = Date.now()): Promise<Outage[]> {
  const from = new Date(now - windowMs);
  const rows = await db
    .select()
    .from(displayEvents)
    .where(
      and(
        eq(displayEvents.displayId, displayId),
        eq(displayEvents.kind, 'offline'),
        or(isNull(displayEvents.resolvedAt), gte(displayEvents.resolvedAt, from)),
      ),
    )
    .orderBy(desc(displayEvents.at))
    .limit(500);
  return rows.map((r) => ({ start: new Date(r.at), end: r.resolvedAt ? new Date(r.resolvedAt) : null }));
}

export async function getRecentEvents(displayId: string, limit = 12): Promise<DisplayEvent[]> {
  return db
    .select()
    .from(displayEvents)
    .where(and(eq(displayEvents.displayId, displayId), ne(displayEvents.kind, 'load')))
    .orderBy(desc(displayEvents.at))
    .limit(limit);
}

// ─── Page loads ──────────────────────────────────────────────────────────────

/** Keep page-load events this long; older ones are pruned by the cron. */
export const LOAD_EVENT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The player page started fresh: its first playlist fetch carries no
 * If-None-Match. Counting these per day tells us whether a kiosk is
 * reloading the page on its own (and re-downloading every background
 * image and video each time), which no amount of in-page caching fixes.
 */
export async function recordPageLoad(
  display: Pick<Display, 'id' | 'tenantId'>,
  userAgent: string | null,
): Promise<void> {
  await db.insert(displayEvents).values({
    tenantId: display.tenantId,
    displayId: display.id,
    kind: 'load',
    meta: { userAgent: userAgent ? userAgent.slice(0, 200) : null },
  });
}

export interface LoadStats {
  /** Fresh page loads in the window. */
  count: number;
  lastAt: Date | null;
  lastUserAgent: string | null;
}

export async function getLoadStats(displayId: string, windowMs: number, now = Date.now()): Promise<LoadStats> {
  const from = new Date(now - windowMs);
  const [agg] = await db
    .select({ n: count() })
    .from(displayEvents)
    .where(and(eq(displayEvents.displayId, displayId), eq(displayEvents.kind, 'load'), gte(displayEvents.at, from)));
  const [last] = await db
    .select({ at: displayEvents.at, meta: displayEvents.meta })
    .from(displayEvents)
    .where(and(eq(displayEvents.displayId, displayId), eq(displayEvents.kind, 'load')))
    .orderBy(desc(displayEvents.at))
    .limit(1);
  const ua = (last?.meta as { userAgent?: unknown } | null)?.userAgent;
  return {
    count: Number(agg?.n ?? 0),
    lastAt: last?.at ? new Date(last.at) : null,
    lastUserAgent: typeof ua === 'string' ? ua : null,
  };
}

export interface PlayerErrorStats {
  /** Error reports from this display's player in the window. */
  count: number;
  lastAt: Date | null;
  lastMessage: string | null;
}

/**
 * What the player on a display has reported (window errors, slide crashes,
 * watchdog reloads) recently. A screen can heartbeat happily while showing
 * an error page, so this is the honest "is it working" signal.
 */
export async function getPlayerErrorStats(displayId: string, windowMs: number, now = Date.now()): Promise<PlayerErrorStats> {
  const from = new Date(now - windowMs);
  const [agg] = await db
    .select({ n: count() })
    .from(errors)
    .where(and(eq(errors.displayId, displayId), gte(errors.createdAt, from)));
  const [last] = await db
    .select({ at: errors.createdAt, message: errors.message })
    .from(errors)
    .where(and(eq(errors.displayId, displayId), gte(errors.createdAt, from)))
    .orderBy(desc(errors.createdAt))
    .limit(1);
  return {
    count: Number(agg?.n ?? 0),
    lastAt: last?.at ? new Date(last.at) : null,
    lastMessage: last?.message ? last.message.slice(0, 200) : null,
  };
}

/** Error reports older than this are dropped by the cron. */
export const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function pruneOldErrors(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ERROR_RETENTION_MS);
  const rows = await db.delete(errors).where(lt(errors.createdAt, cutoff)).returning({ id: errors.id });
  return rows.length;
}

/** A burst of player errors this big inside ERROR_BURST_WINDOW_MS gets an email. */
export const ERROR_BURST_COUNT = 3;
export const ERROR_BURST_WINDOW_MS = 15 * 60 * 1000;
/** At most one error email per display per hour. */
const ERROR_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * A screen can heartbeat happily while showing an error page, so outage
 * alerts alone are not enough. When a display's player has reported
 * ERROR_BURST_COUNT or more errors in the last ERROR_BURST_WINDOW_MS, send
 * the tenant's alert emails one message (then stay quiet for an hour).
 */
export async function alertOnPlayerErrors(all: Display[], now = new Date()): Promise<number> {
  let sent = 0;
  for (const d of all) {
    const stats = await getPlayerErrorStats(d.id, ERROR_BURST_WINDOW_MS, now.getTime());
    if (stats.count < ERROR_BURST_COUNT) continue;
    const [recent] = await db
      .select({ at: displayEvents.at })
      .from(displayEvents)
      .where(and(eq(displayEvents.displayId, d.id), eq(displayEvents.kind, 'error_alert'), gte(displayEvents.at, new Date(now.getTime() - ERROR_ALERT_COOLDOWN_MS))))
      .limit(1);
    if (recent) continue;
    const ok = await sendDisplayAlert(d, 'errors', { errorCount: stats.count, lastMessage: stats.lastMessage ?? undefined });
    if (!ok) continue;
    await db.insert(displayEvents).values({
      tenantId: d.tenantId,
      displayId: d.id,
      kind: 'error_alert',
      at: now,
      meta: { count: stats.count, lastMessage: stats.lastMessage },
    });
    sent++;
  }
  return sent;
}

export async function pruneLoadEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LOAD_EVENT_RETENTION_MS);
  const rows = await db
    .delete(displayEvents)
    .where(and(eq(displayEvents.kind, 'load'), lt(displayEvents.at, cutoff)))
    .returning({ id: displayEvents.id });
  return rows.length;
}

// ─── Commands ────────────────────────────────────────────────────────────────

export const AGENT_COMMANDS: AgentCommand[] = ['reboot', 'reload', 'screenshot', 'update'];

export function isAgentCommand(value: unknown): value is AgentCommand {
  return typeof value === 'string' && (AGENT_COMMANDS as string[]).includes(value);
}

/**
 * Queue a command. On a Pi the agent carries it out on its next check-in.
 * 'reload' on non-Pi hardware (OptiSigns, a laptop) sets reloadRequestedAt
 * instead, which the browser player honors on its next heartbeat — so
 * "Reload player" works everywhere, and a Pi doesn't reload twice.
 */
export async function queueCommand(
  display: Display,
  command: AgentCommand,
  by: string | null,
  now = new Date(),
): Promise<void> {
  const isPi = display.hardware === 'pi';
  await db
    .update(displays)
    .set(
      isPi
        ? { pendingCommand: command, pendingCommandAt: now, pendingCommandBy: by }
        : command === 'reload'
          ? { reloadRequestedAt: now }
          : { pendingCommand: command, pendingCommandAt: now, pendingCommandBy: by },
    )
    .where(eq(displays.id, display.id));
  await db.insert(displayEvents).values({
    tenantId: display.tenantId,
    displayId: display.id,
    kind: 'command',
    at: now,
    meta: { command, by },
  });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function tenantContext(tenantId: string): Promise<{ settings: Settings | undefined; name: string }> {
  const [s, t] = await Promise.all([
    db.query.settings.findFirst({ where: eq(settings.tenantId, tenantId) }),
    db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }),
  ]);
  return { settings: s, name: t?.name ?? 'Foyer' };
}

export async function sendDisplayAlert(
  display: Display,
  kind: 'down' | 'up' | 'errors',
  info: { downForSec?: number; since?: Date; errorCount?: number; lastMessage?: string } = {},
): Promise<boolean> {
  const { settings: s, name } = await tenantContext(display.tenantId);
  const to = parseEmailList(s?.alertEmails);
  if (to.length === 0) return false;

  const where = display.location ? ` (${display.location})` : '';
  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? ''}/admin/displays`;
  const subject =
    kind === 'down'
      ? `Screen down: ${display.name}`
      : kind === 'errors'
        ? `Screen showing errors: ${display.name}`
        : `Screen back: ${display.name}`;
  const body =
    kind === 'errors'
      ? [
          `The "${display.name}"${where} screen's player has reported ${info.errorCount ?? 'several'} errors in the last 15 minutes.`,
          'It is online, but it may be showing an error page instead of the slides.',
          info.lastMessage ? `Last error: ${info.lastMessage}` : '',
          '',
          'Check the Displays page (the card shows the errors) or open the display URL in a browser:',
          adminUrl,
          '',
          `If a change was just published, that is the first thing to undo. — ${name}`,
        ]
      : kind === 'down'
      ? [
          `The "${display.name}"${where} screen has stopped checking in.`,
          info.since ? `Last seen ${info.since.toLocaleString('en-US', { timeZone: 'America/New_York' })} Eastern.` : '',
          '',
          'Things to check: is the TV on and set to the right input? Is the Pi or player powered and on the network?',
          'You can reboot it or take a screenshot from the Displays page:',
          adminUrl,
          '',
          `You will get one more email when it comes back. — ${name}`,
        ]
      : [
          `The "${display.name}"${where} screen is back online.`,
          info.downForSec !== undefined ? `It was down for ${formatDuration(info.downForSec)}.` : '',
          '',
          adminUrl,
        ];

  const resend = getResend();
  await resend.emails.send({
    from: resolveFromAddress(s),
    to,
    subject,
    text: body.filter((l) => l !== undefined).join('\n'),
  });
  return true;
}

/**
 * The cron body: for every active display in the system, open outages
 * where needed and send "down" alerts once the tenant's threshold has
 * passed. Returns counts for the cron's JSON response.
 */
export async function runDisplayCheck(now = new Date()): Promise<{ checked: number; newOutages: number; alerted: number; errorAlerts?: number; quiet?: boolean }> {
  // Overnight the lobby is dark and the players beat slowly; touching the
  // database every five minutes would only keep it awake.
  if (isQuietHour(now)) return { checked: 0, newOutages: 0, alerted: 0, quiet: true };

  const all = await db.query.displays.findMany({ where: eq(displays.active, true) });
  let newOutages = 0;
  let alerted = 0;
  await pruneLoadEvents(now).catch((err) => console.error('[fleet] prune load events failed', err));
  await pruneOldErrors(now).catch((err) => console.error('[fleet] prune errors failed', err));
  const errorAlerts = await alertOnPlayerErrors(all, now).catch((err) => {
    console.error('[fleet] error alerts failed', err);
    return 0;
  });

  const settingsByTenant = new Map<string, Settings | undefined>();

  for (const d of all) {
    const before = d.offlineSince;
    const after = await noteOfflineIfSilent(d, now);
    if (!before && after.offlineSince) newOutages++;
    if (!after.offlineSince) continue;

    if (!settingsByTenant.has(d.tenantId)) {
      settingsByTenant.set(
        d.tenantId,
        await db.query.settings.findFirst({ where: eq(settings.tenantId, d.tenantId) }),
      );
    }
    const s = settingsByTenant.get(d.tenantId);
    if (parseEmailList(s?.alertEmails).length === 0) continue;

    const thresholdMs = (s?.alertOfflineAfterMin ?? 10) * 60_000;
    if (now.getTime() - new Date(after.offlineSince).getTime() < thresholdMs) continue;

    const [open] = await db
      .select()
      .from(displayEvents)
      .where(
        and(
          eq(displayEvents.displayId, d.id),
          eq(displayEvents.kind, 'offline'),
          isNull(displayEvents.resolvedAt),
        ),
      )
      .orderBy(desc(displayEvents.at))
      .limit(1);
    if (!open || open.alertedAt) continue;

    // Claim the alert before sending so two overlapping cron runs can't
    // both email.
    const [claimed] = await db
      .update(displayEvents)
      .set({ alertedAt: now })
      .where(and(eq(displayEvents.id, open.id), isNull(displayEvents.alertedAt)))
      .returning();
    if (!claimed) continue;

    try {
      await sendDisplayAlert(after, 'down', { since: new Date(open.at) });
      alerted++;
    } catch (err) {
      console.error('[fleet] down email failed', err);
      await db.update(displayEvents).set({ alertedAt: null }).where(eq(displayEvents.id, open.id));
    }
  }

  return { checked: all.length, newOutages, alerted, errorAlerts };
}
