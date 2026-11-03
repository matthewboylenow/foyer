import { z } from 'zod';
import { and, desc, eq, inArray, like, or } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/server';
import { db } from '@/lib/db/client';
import { auditLog, displays, slides } from '@/lib/db/schema';
import type { Slide, SlideContent, Tenant } from '@/lib/db/schema';
import { logAudit } from '@/lib/auth/session';
import { getPublishStatus, publishPlaylist } from '@/lib/publish';
import { agentStatus } from '@/lib/monitoring';
import { IngestError, IngestRequestSchema, TEMPLATE_CATALOG, splitSourceKey, upsertSlides } from '@/lib/ingest';

/**
 * The tools a chat client gets. Every write goes through the same code as
 * POST /api/ingest (lib/ingest.ts) and leaves an audit row named
 * "mcp:<tool>". Reads never truncate slide text.
 *
 * Staging reminder, repeated in the tool descriptions because it is the
 * thing a client will get wrong: edits are staged until published. Pass
 * publish: true, or call publish_screens, to change what the TVs show.
 */

export interface ToolContext {
  tenant: Tenant;
  /** Goes into updated_by and audit rows. */
  actor: string;
}

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function json(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function iso(d: Date | string | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

/** The one line that stands for the slide, whatever the template. */
function headlineOf(content: SlideContent | Record<string, never>): string {
  const c = content as Record<string, unknown>;
  for (const k of ['headline', 'quote', 'name', 'weekendLabel', 'caption']) {
    if (typeof c[k] === 'string' && c[k]) return c[k] as string;
  }
  return '';
}

function summarize(s: Slide) {
  const c = s.content as Record<string, unknown>;
  const { source, sourceId } = splitSourceKey(s.sourceId);
  return {
    id: s.id,
    source,
    sourceId,
    title: s.title,
    templateType: s.templateType,
    headline: headlineOf(s.content as SlideContent),
    meta: typeof c.meta === 'string' ? c.meta : '',
    body: typeof c.body === 'string' ? c.body : '',
    eventDate: typeof c.eventDate === 'string' ? c.eventDate : null,
    qrUrl: typeof c.qrUrl === 'string' ? c.qrUrl : null,
    scheduleType: s.scheduleType,
    startAt: iso(s.startAt),
    endAt: iso(s.endAt),
    weight: s.weight,
    active: s.active,
    pin: s.pin,
    takeover: s.priority,
    updatedAt: iso(s.updatedAt),
    updatedBy: s.updatedBy,
  };
}

const uuid = z.string().uuid().describe('The slide id (from list_slides).');

const PUBLISH_NOTE =
  'Nothing reaches the TVs until it is published: pass publish: true here, or call publish_screens afterwards. Until then the change is staged and visible only in the admin.';

export function registerFoyerTools(server: McpServer, ctx: ToolContext): void {
  const tenantId = ctx.tenant.id;

  server.registerTool(
    'list_slides',
    {
      title: 'List slides',
      description:
        'List the slides for this parish. Defaults to the ones that are on. Each row carries the full body text (HTML as stored) plus headline, when/where line, dates, weight, pin and who last changed it. Filter by source to see only slides an outside system owns (e.g. source "chat" or "comms-portal"); slides made in the admin have source null.',
      inputSchema: z.object({
        status: z
          .enum(['active', 'inactive', 'all'])
          .default('active')
          .describe('"active" = currently on (default), "inactive" = turned off, "all" = both.'),
        source: z
          .string()
          .trim()
          .max(40)
          .optional()
          .describe('Only slides whose source matches, e.g. "chat". Use "admin" for slides with no source.'),
      }),
    },
    async ({ status, source }) => {
      const rows = await db.query.slides.findMany({
        where: eq(slides.tenantId, tenantId),
        orderBy: [desc(slides.active), desc(slides.updatedAt)],
      });
      const filtered = rows.filter((s) => {
        if (status === 'active' && !s.active) return false;
        if (status === 'inactive' && s.active) return false;
        if (source === 'admin') return !s.sourceId;
        if (source) return splitSourceKey(s.sourceId).source === source;
        return true;
      });
      return json({
        count: filtered.length,
        totals: { active: rows.filter((r) => r.active).length, inactive: rows.filter((r) => !r.active).length },
        slides: filtered.map(summarize),
      });
    },
  );

  server.registerTool(
    'get_slide',
    {
      title: 'Get one slide',
      description: 'The full database row for one slide, including the content JSON exactly as the template renders it. Nothing is shortened.',
      inputSchema: z.object({ id: uuid }),
    },
    async ({ id }) => {
      const row = await db.query.slides.findFirst({ where: and(eq(slides.tenantId, tenantId), eq(slides.id, id)) });
      if (!row) return fail(`No slide with id ${id}.`);
      return json({ ...summarize(row), content: row.content, contentLandscape: row.contentLandscape, targetDisplays: row.targetDisplays, durationOverrideSec: row.durationOverrideSec, collectionId: row.collectionId, createdAt: iso(row.createdAt), createdBy: row.createdBy });
    },
  );

  server.registerTool(
    'upsert_slides',
    {
      title: 'Create or update slides',
      description: [
        'Create or update announcement slides from your own ids. Send the same sourceId again to update that slide; new sourceIds create slides. Only the fields an outside system owns are written (title, template, text, dates, weight, on/off); pins, takeover and per-TV targeting set in the admin are kept.',
        'Fields: headline is the big line (event name, under ~50 characters, 7 words or fewer; it always renders at the small size). meta is the one-line when/where under it, e.g. "Saturday, November 8 · 5:00 PM · Meaney Hall". body is the announcement text as written, plain text with blank lines between paragraphs; never summarize or cut parish copy. cta is a closing sentence on its own bold line; ctaUrl becomes a QR code. endAt should be the event start time so the screens stop advertising an event once it has begun; startAt can be omitted.',
        'prune: true turns off (never deletes) every slide from this source that is not in the payload, so sending the full current set keeps the screens in sync.',
        PUBLISH_NOTE,
      ].join(' '),
      inputSchema: IngestRequestSchema,
    },
    async (args) => {
      try {
        const result = await upsertSlides(tenantId, args, ctx.actor, 'mcp:upsert_slides');
        return json({
          ...result,
          note: result.published
            ? 'Published. The TVs switch within a minute.'
            : 'Staged only. Call publish_screens (or pass publish: true) to put this on the TVs.',
        });
      } catch (err) {
        if (err instanceof IngestError) return fail(err.message);
        throw err;
      }
    },
  );

  server.registerTool(
    'set_slide_active',
    {
      title: 'Turn a slide on or off',
      description: `Turn one slide on or off by id. Works on any slide, including ones made in the admin. Off keeps the slide for later; nothing is deleted. ${PUBLISH_NOTE}`,
      inputSchema: z.object({
        id: uuid,
        active: z.boolean().describe('true = on (plays), false = off (kept but not played).'),
        publish: z.boolean().default(false).describe('Also publish to the TVs right away.'),
      }),
    },
    async ({ id, active, publish }) => {
      const existing = await db.query.slides.findFirst({ where: and(eq(slides.tenantId, tenantId), eq(slides.id, id)) });
      if (!existing) return fail(`No slide with id ${id}.`);
      if (existing.active !== active) {
        await db
          .update(slides)
          .set({ active, updatedAt: new Date(), updatedBy: ctx.actor })
          .where(eq(slides.id, id));
      }
      await logAudit({
        tenantId,
        userId: ctx.actor,
        action: 'mcp:set_slide_active',
        targetType: 'slide',
        targetId: id,
        metadata: { title: existing.title, from: existing.active, to: active, publish },
      });
      let published = false;
      if (publish) {
        await publishPlaylist(tenantId, ctx.actor, 'mcp');
        published = true;
      }
      return json({
        id,
        title: existing.title,
        active,
        changed: existing.active !== active,
        published,
        note: published ? 'Published. The TVs switch within a minute.' : 'Staged only. Call publish_screens to put this on the TVs.',
      });
    },
  );

  server.registerTool(
    'publish_screens',
    {
      title: 'Publish to the TVs',
      description:
        'Push the current set of slides that are on to every TV. This is the same button as "Publish to screens" in the admin: it publishes everything staged, including edits other people made, so check get_screen_status first if that matters.',
      inputSchema: z.object({}),
    },
    async () => {
      const before = await getPublishStatus(tenantId);
      const snap = await publishPlaylist(tenantId, ctx.actor, 'mcp');
      await logAudit({
        tenantId,
        userId: ctx.actor,
        action: 'mcp:publish_screens',
        targetType: 'snapshot',
        targetId: snap.id,
        metadata: { slideCount: snap.slideCount, changesPublished: before.changes.length },
      });
      return json({
        publishedAt: iso(snap.publishedAt),
        slideCount: snap.slideCount,
        changesPublished: before.changes,
        note: 'The TVs switch within a minute.',
      });
    },
  );

  server.registerTool(
    'get_screen_status',
    {
      title: 'Screen status',
      description:
        'What the TVs are doing: how many slides are on, which sources own them, whether anything is staged but not yet published (and what), each TV and whether it is online, the last ingest/MCP audit rows, and the templates this app supports with the fields each takes, so you can build valid upsert_slides payloads without reading code.',
      inputSchema: z.object({}),
    },
    async () => {
      const [rows, status, tvs, audit] = await Promise.all([
        db.query.slides.findMany({
          where: eq(slides.tenantId, tenantId),
          columns: { id: true, active: true, sourceId: true, priority: true },
        }),
        getPublishStatus(tenantId),
        db.query.displays.findMany({
          where: eq(displays.tenantId, tenantId),
          columns: { id: true, name: true, location: true, orientation: true, lastHeartbeatAt: true, active: true },
        }),
        db.query.auditLog.findMany({
          where: and(
            eq(auditLog.tenantId, tenantId),
            or(like(auditLog.action, 'mcp:%'), like(auditLog.action, 'ingest:%'), like(auditLog.action, 'import.%')),
          ),
          orderBy: [desc(auditLog.createdAt)],
          limit: 10,
        }),
      ]);

      const bySource: Record<string, { active: number; inactive: number }> = {};
      for (const r of rows) {
        const key = splitSourceKey(r.sourceId).source ?? 'admin';
        bySource[key] ??= { active: 0, inactive: 0 };
        bySource[key][r.active ? 'active' : 'inactive'] += 1;
      }

      return json({
        parish: ctx.tenant.name,
        slides: {
          active: rows.filter((r) => r.active).length,
          inactive: rows.filter((r) => !r.active).length,
          takeoverOn: rows.some((r) => r.active && r.priority),
          bySource,
        },
        screens: {
          lastPublishedAt: status.publishedAt,
          lastPublishedBy: status.publishedBy,
          slidesOnScreens: status.slideCount,
          stagedChanges: status.changes.map((c) => `${c.title || 'Untitled'} (${c.kind})`),
          upToDate: !status.dirty,
        },
        displays: tvs.map((d) => ({
          id: d.id,
          name: d.name,
          location: d.location,
          orientation: d.orientation,
          enabled: d.active,
          status: agentStatus(d.lastHeartbeatAt),
          lastHeartbeatAt: iso(d.lastHeartbeatAt),
        })),
        recentActivity: audit.map((a) => ({ at: iso(a.createdAt), action: a.action, by: a.userEmail ?? a.userId, target: a.targetId, details: a.metadata })),
        templates: TEMPLATE_CATALOG,
        ingestContract: {
          endpoint: 'upsert_slides tool, or POST /api/ingest with Authorization: Bearer <token>',
          payload: '{ source, prune?, publish?, slides: [{ sourceId, title, templateType?, content: { headline, meta?, body?, cta?, ctaUrl?, eventDate? }, startAt?, endAt?, weight?, active? }] }',
        },
      });
    },
  );

  // Defensive: keep the inArray import used if a future tool needs it.
  void inArray;
}
