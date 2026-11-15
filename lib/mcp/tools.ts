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
import { htmlToText } from '@/lib/import/html-to-text';
import { parseEmailText } from '@/lib/import/parse-email';
import { createEmailSlides, defaultImportCollectionName } from '@/lib/import/create-slides';
import { applyParishUpdate, readBulletin } from '@/lib/import/bulletin';

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

  // ── The weekly email, the same two steps as Admin → Email import ──────────

  server.registerTool(
    'read_email',
    {
      title: 'Read the weekly email',
      description:
        'Step 1 of the weekly email import, identical to the Email import page. Paste the whole email (HubSpot "View source" HTML, or the plain text) and get back one proposed slide per section: heading, the date/time/place line, the paragraphs exactly as written, the call to action on its own line, the link, and the event date. Sections that look like a letter or boilerplate come back with kind "letter" or "other" so you can leave them out. Nothing is saved; review the list, then call create_email_slides with the items you want. Takes 30 to 90 seconds.',
      inputSchema: z.object({
        source: z.string().min(40).max(2_000_000).describe('The email as HTML source or plain text, unedited.'),
      }),
    },
    async ({ source }) => {
      if (!process.env.ANTHROPIC_API_KEY) return fail('ANTHROPIC_API_KEY is not set on the server.');
      const text = htmlToText(source);
      if (text.length < 40) return fail('Nothing readable in that paste.');
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York',
      });
      const result = await parseEmailText(text, today);
      return json({
        words: text.split(/\s+/).filter(Boolean).length,
        sections: result.items.length,
        items: result.items,
        next: 'Review, then call create_email_slides with the items to keep (announcements are usually all of them; letters usually not).',
      });
    },
  );

  server.registerTool(
    'create_email_slides',
    {
      title: 'Create this week\'s email slides',
      description: [
        'Step 2 of the weekly email import. Creates one General slide per item in a new collection named "Email blast · <today>", exactly as the Email import page does.',
        'deactivatePrevious (default true) turns off the slides from earlier email blasts so the screens roll over to this week\'s set. Each item with an eventDate turns itself off the morning after the event unless expireAfterEvent is false.',
        'publish (default true) puts the result on the TVs right away; with false it is staged until publish_screens.',
      ].join(' '),
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              heading: z.string().trim().min(1).max(120).describe('Headline, as written in the email.'),
              subtitle: z.string().trim().max(200).default('').describe('Date · time · place line.'),
              paragraphs: z.array(z.string().max(2000)).max(20).default([]).describe('Body paragraphs, verbatim.'),
              cta: z.string().trim().max(300).default('').describe('Call to action sentence, on its own line.'),
              ctaUrl: z.string().trim().max(500).default('').describe('Link for the QR code (https).'),
              eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default('').describe('YYYY-MM-DD, or empty.'),
              expireAfterEvent: z.boolean().default(true).describe('Turn the slide off the morning after eventDate.'),
            }),
          )
          .min(1)
          .max(40),
        collectionName: z.string().trim().max(80).optional().describe('Defaults to "Email blast · <today>".'),
        deactivatePrevious: z.boolean().default(true),
        publish: z.boolean().default(true),
      }),
    },
    async ({ items, collectionName, deactivatePrevious, publish }) => {
      const result = await createEmailSlides(
        tenantId,
        { items, collectionName: collectionName ?? defaultImportCollectionName(), deactivatePrevious, publish },
        { label: ctx.actor },
        'mcp:create_email_slides',
      );
      return json({
        ...result,
        note: result.published
          ? 'Published. The TVs switch within a minute.'
          : 'Staged only. Call publish_screens to put these on the TVs.',
      });
    },
  );

  // ── The weekly bulletin → Mass intentions, Mass association, Sanctuary candle ──

  const massRow = z.object({
    timeLabel: z.string().trim().min(1).max(40).describe('"5:00PM" for weekend rows, "Nov 16" for daily rows.'),
    intention: z.string().trim().min(1).max(200).describe('The intention as printed, e.g. "Margaret Mindnich" or "People of the Parish".'),
  });

  server.registerTool(
    'read_bulletin',
    {
      title: 'Read the weekly bulletin',
      description:
        'Pulls the three parish items out of the weekly bulletin PDF: the Mass intentions (weekend label, weekend rows, daily rows), the Weekly Mass Association names, and the Sanctuary candle name. With no arguments it finds the newest bulletin on the parish website; or give a PDF url, or the already-extracted text of the page. Nothing is saved: review the result, then call update_parish_slides (or pass fromBulletin: true there to do both in one step).',
      inputSchema: z.object({
        url: z.string().url().optional().describe('A bulletin PDF (https). Omit to use the newest one on the parish site.'),
        text: z.string().max(200_000).optional().describe('Text of the bulletin page, if you already have it (e.g. copied from the PDF).'),
      }),
    },
    async ({ url, text }) => {
      const r = await readBulletin({ url, text });
      if (!r.found) return fail(r.warnings.join(' ') || 'Could not find the Mass intentions column.');
      return json({ ...r, next: 'Call update_parish_slides with these values (or fromBulletin: true) to put them on the three parish slides.' });
    },
  );

  server.registerTool(
    'update_parish_slides',
    {
      title: 'Update the three parish slides',
      description: [
        'Writes the Mass intentions, Weekly Mass Association and Sanctuary candle slides, exactly like Save on the "This week" page. Give only the parts you want to change; the others are left alone.',
        'fromBulletin: true reads the newest bulletin first (see read_bulletin) and uses its values; any field you also pass wins over the bulletin.',
        'weekendLabel is the heading over the weekend Masses ("Weekend of November 14 / 15"). weekendRows are the Saturday/Sunday Masses with timeLabel "5:00PM" style; weekdayRows the daily Masses with timeLabel "Nov 16" style. associationNames is the full list for the week. candle has the name and whether it is in memory of (true) or in honor of (false).',
        PUBLISH_NOTE,
      ].join(' '),
      inputSchema: z.object({
        fromBulletin: z.boolean().default(false).describe('Read the newest bulletin and apply it.'),
        bulletinUrl: z.string().url().optional().describe('A specific bulletin PDF to read instead of the newest.'),
        weekendLabel: z.string().trim().max(80).optional(),
        weekendRows: z.array(massRow).max(12).optional(),
        weekdayRows: z.array(massRow).max(14).optional(),
        associationNames: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
        candle: z.object({ name: z.string().trim().min(1).max(80), inMemoryOf: z.boolean().default(true) }).optional(),
        publish: z.boolean().default(false).describe('Also publish to the TVs right away.'),
      }),
    },
    async ({ fromBulletin, bulletinUrl, weekendLabel, weekendRows, weekdayRows, associationNames, candle, publish }) => {
      let source: string | null = null;
      let warnings: string[] = [];
      const update: Parameters<typeof applyParishUpdate>[1] = {};
      if (fromBulletin || bulletinUrl) {
        const r = await readBulletin({ url: bulletinUrl });
        if (!r.found) return fail(r.warnings.join(' ') || 'Could not find the Mass intentions column in the bulletin.');
        source = r.sourceUrl;
        warnings = r.warnings;
        if (r.weekendLabel) update.weekendLabel = r.weekendLabel;
        if (r.weekendRows.length) update.weekendRows = r.weekendRows;
        if (r.weekdayRows.length) update.weekdayRows = r.weekdayRows;
        if (r.associationNames.length) update.associationNames = r.associationNames;
        if (r.candle) update.candle = r.candle;
      }
      if (weekendLabel !== undefined) update.weekendLabel = weekendLabel;
      if (weekendRows) update.weekendRows = weekendRows;
      if (weekdayRows) update.weekdayRows = weekdayRows;
      if (associationNames) update.associationNames = associationNames;
      if (candle) update.candle = { name: candle.name, inMemoryOf: candle.inMemoryOf };
      if (Object.keys(update).length === 0) return fail('Nothing to update: pass fields, or fromBulletin: true.');

      const result = await applyParishUpdate(tenantId, update, ctx.actor, {
        publish,
        auditAction: 'mcp:update_parish_slides',
        reason: 'mcp',
        source,
      });
      return json({
        ...result,
        applied: update,
        source,
        warnings,
        note: result.published ? 'Published. The TVs switch within a minute.' : 'Staged only. Call publish_screens to put this on the TVs.',
      });
    },
  );

  // Defensive: keep the inArray import used if a future tool needs it.
  void inArray;
}
