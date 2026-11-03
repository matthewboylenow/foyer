import { z } from 'zod';
import { and, eq, inArray, like, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { collections, slides } from '@/lib/db/schema';
import type { GeneralContent, Slide, WelcomeQuoteContent } from '@/lib/db/schema';
import { logAudit } from '@/lib/auth/session';
import { publishPlaylist } from '@/lib/publish';

/**
 * Source-owned slides. An outside system (the comms portal, a chat client
 * through the MCP server, a script) sends slides keyed by its own ids;
 * Foyer stores them with `slides.source_id = "<source>:<sourceId>"` so the
 * same payload can be sent again and again: new ids insert, known ids
 * update, and `prune` turns off anything the source no longer sends.
 * Nothing is ever deleted here.
 *
 * This file is the single contract shared by POST /api/ingest and the MCP
 * tools, and it does the database work for both.
 */

// ─── Contract ────────────────────────────────────────────────────────────────

export const SOURCE_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;

export const SourceSchema = z
  .string()
  .regex(SOURCE_RE, 'lowercase letters, digits, "-" and "_" only, 2 to 40 characters')
  .describe(
    'Short name of the system sending these slides, e.g. "comms-portal" or "chat". Slides are keyed by source + sourceId, and prune only touches this source.',
  );

const isoDateTime = z.iso
  .datetime({ offset: true })
  .describe('ISO 8601 with a timezone offset, e.g. "2026-11-08T18:00:00-05:00".');

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const IngestContentSchema = z
  .object({
    headline: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe(
        'General template. The big line at the top of the slide: the name of the event or announcement, e.g. "Saint Helen Fest". Read from across a lobby, so keep it under about 50 characters and 7 words; it always renders at the small headline size. Required for template "general".',
      ),
    headlineSize: z
      .enum(['small', 'medium', 'large'])
      .optional()
      .describe('Ignored; every headline renders small. Accepted so older payloads still validate.'),
    meta: z
      .string()
      .trim()
      .max(160)
      .optional()
      .describe(
        'General template. The one-line "when and where" under the headline, e.g. "Saturday, November 8 · 5:00 PM · Meaney Hall". Leave empty to show eventDate formatted, or nothing.',
      ),
    body: z
      .string()
      .max(4000)
      .optional()
      .describe(
        'General template. The announcement text, as written. Plain text: blank line between paragraphs, a line starting with "- " is a bullet, **bold** for emphasis. Never summarize or truncate parish copy.',
      ),
    cta: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe('General template. Call to action on its own bold line at the end, e.g. "To sign up, visit sainthelen.org/fest."'),
    ctaUrl: z
      .url()
      .max(500)
      .optional()
      .describe('General template. https link rendered as a QR code in the corner of the slide.'),
    eventDate: ymd.optional().describe('General template. The event date, YYYY-MM-DD. Shown as a date line when meta is empty.'),
    textMode: z
      .enum(['dark', 'light'])
      .optional()
      .describe('General template. "dark" text on the cream background (default) or "light" text on navy.'),
    quote: z
      .string()
      .trim()
      .min(1)
      .max(400)
      .optional()
      .describe('Welcome Quote template. The quotation or scripture line. Required for template "welcome_quote".'),
    attribution: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe('Welcome Quote template. Who said it, e.g. "Psalm 118:24" or "Pope Leo XIV".'),
  })
  .strict();

export const IngestSlideSchema = z
  .object({
    sourceId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe('Your stable id for this item (a request id, post id, or slug). Sending the same sourceId again updates that slide instead of creating another.'),
    title: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe('Internal name shown in the admin grid, never on the TV. Usually the same as the headline.'),
    templateType: z
      .enum(['general', 'welcome_quote'])
      .default('general')
      .describe('"general" (headline, when/where line, body, optional QR) for announcements; "welcome_quote" for a scripture or quote slide.'),
    content: IngestContentSchema,
    startAt: isoDateTime
      .nullable()
      .optional()
      .describe('When the slide should start playing. Omit or null to start right away.'),
    endAt: isoDateTime
      .nullable()
      .optional()
      .describe(
        'When the slide should stop playing. For an event, use the event start time so the screens stop advertising it once it has begun. Omit or null to play until turned off.',
      ),
    weight: z
      .number()
      .int()
      .min(0)
      .max(3)
      .default(1)
      .describe('How often it comes up in the shuffle: 1 normal, 2 twice as often, 3 three times, 0 never.'),
    active: z
      .boolean()
      .default(true)
      .describe('false parks the slide in the admin as "off" without deleting it.'),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.templateType === 'general' && !s.content.headline) {
      ctx.addIssue({ code: 'custom', path: ['content', 'headline'], message: 'headline is required for the general template' });
    }
    if (s.templateType === 'welcome_quote' && !s.content.quote) {
      ctx.addIssue({ code: 'custom', path: ['content', 'quote'], message: 'quote is required for the welcome_quote template' });
    }
    if (s.startAt && s.endAt && new Date(s.endAt) <= new Date(s.startAt)) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'endAt must be after startAt' });
    }
  });

export const IngestRequestSchema = z
  .object({
    source: SourceSchema,
    slides: z.array(IngestSlideSchema).min(1).max(100),
    prune: z
      .boolean()
      .default(false)
      .describe('Turn off (never delete) every slide from this source that is not in this payload. Use it when sending the full current set.'),
    publish: z
      .boolean()
      .default(false)
      .describe('Push the result to the TVs right away. Otherwise changes are staged until someone publishes (admin button or the publish_screens tool).'),
  })
  .strict();

export type IngestSlide = z.infer<typeof IngestSlideSchema>;
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

// ─── Mapping ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  // Escape first, then the one bit of markup we allow.
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Plain text → the HTML the General template expects. Paragraphs on blank
 * lines, "- " bullets become a list, single newlines become <br>, the CTA
 * is a bold paragraph of its own. Everything is escaped; no HTML is passed
 * through from callers.
 */
export function textToBodyHtml(body: string | undefined, cta?: string): string {
  const blocks = (body ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0 && lines.every((l) => /^[-•*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    });
  if (cta?.trim()) blocks.push(`<p><strong>${esc(cta.trim())}</strong></p>`);
  return blocks.join('');
}

export function sourceKey(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function splitSourceKey(key: string | null): { source: string | null; sourceId: string | null } {
  if (!key) return { source: null, sourceId: null };
  const i = key.indexOf(':');
  if (i < 0) return { source: key, sourceId: null };
  return { source: key.slice(0, i), sourceId: key.slice(i + 1) };
}

export function toSlideContent(item: IngestSlide): GeneralContent | WelcomeQuoteContent {
  const c = item.content;
  if (item.templateType === 'welcome_quote') {
    return {
      templateType: 'welcome_quote',
      quote: c.quote ?? '',
      quoteSize: 'large',
      attribution: c.attribution || undefined,
      textMode: c.textMode ?? 'dark',
    };
  }
  return {
    templateType: 'general',
    headline: c.headline ?? '',
    headlineSize: 'small',
    meta: c.meta ?? '',
    body: textToBodyHtml(c.body, c.cta),
    eventDate: c.eventDate || undefined,
    qrUrl: c.ctaUrl || undefined,
    qrLabel: c.ctaUrl ? 'Scan to visit' : undefined,
    motionStyle: 'lineMask',
    textMode: c.textMode ?? 'dark',
  };
}

/** The columns an ingest owns. Admin-side columns (pin, priority, duration,
 *  targetDisplays, displayOrder) are left alone on update. */
export function toSlideValues(
  tenantId: string,
  source: string,
  item: IngestSlide,
  actor: string,
  collectionId: string | null,
) {
  const startAt = item.startAt ? new Date(item.startAt) : null;
  const endAt = item.endAt ? new Date(item.endAt) : null;
  return {
    tenantId,
    sourceId: sourceKey(source, item.sourceId),
    title: item.title,
    templateType: item.templateType,
    content: toSlideContent(item),
    contentLandscape: null,
    scheduleType: (startAt || endAt ? 'dated' : 'evergreen') as 'dated' | 'evergreen',
    startAt,
    endAt,
    weight: item.weight,
    active: item.active,
    collectionId,
    updatedAt: new Date(),
    updatedBy: actor,
  };
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

export interface UpsertResultItem {
  id: string;
  sourceId: string;
  title: string;
  action: 'created' | 'updated' | 'unchanged';
}

export interface UpsertResult {
  source: string;
  results: UpsertResultItem[];
  pruned: { id: string; sourceId: string; title: string }[];
  summary: { created: number; updated: number; unchanged: number; pruned: number };
  published: boolean;
}

async function ensureSourceCollection(tenantId: string, source: string): Promise<string> {
  const name = `From ${source}`;
  const existing = await db.query.collections.findFirst({
    where: and(eq(collections.tenantId, tenantId), eq(collections.name, name)),
  });
  if (existing) return existing.id;
  const [created] = await db
    .insert(collections)
    .values({ tenantId, name, color: 'sky', displayOrder: 1000 })
    .returning({ id: collections.id });
  return created.id;
}

function sameEditorial(existing: Slide, values: ReturnType<typeof toSlideValues>): boolean {
  const t = (d: Date | string | null) => (d ? new Date(d).getTime() : null);
  return (
    existing.title === values.title &&
    existing.templateType === values.templateType &&
    JSON.stringify(existing.content) === JSON.stringify(values.content) &&
    existing.scheduleType === values.scheduleType &&
    t(existing.startAt) === t(values.startAt) &&
    t(existing.endAt) === t(values.endAt) &&
    existing.weight === values.weight &&
    existing.active === values.active
  );
}

/**
 * Apply one validated ingest request for a tenant. `actor` goes into
 * updated_by and the audit row; `auditAction` is e.g. "ingest:upsert" or
 * "mcp:upsert_slides".
 */
export async function upsertSlides(
  tenantId: string,
  request: IngestRequest,
  actor: string,
  auditAction: string,
): Promise<UpsertResult> {
  const { source, prune, publish } = request;
  const keys = request.slides.map((s) => sourceKey(source, s.sourceId));
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length > 0) {
    throw new IngestError(`Duplicate sourceId in payload: ${[...new Set(dupes)].map((k) => splitSourceKey(k).sourceId).join(', ')}`);
  }

  const collectionId = await ensureSourceCollection(tenantId, source);
  const existingRows = await db.query.slides.findMany({
    where: and(eq(slides.tenantId, tenantId), inArray(slides.sourceId, keys)),
  });
  const existingByKey = new Map(existingRows.map((r) => [r.sourceId as string, r]));

  const results: UpsertResultItem[] = [];
  for (const item of request.slides) {
    const values = toSlideValues(tenantId, source, item, actor, collectionId);
    const existing = existingByKey.get(values.sourceId);
    if (!existing) {
      const [row] = await db
        .insert(slides)
        .values({ ...values, createdBy: actor, priority: false, pin: null, targetDisplays: [], displayOrder: 0 })
        .returning({ id: slides.id });
      results.push({ id: row.id, sourceId: item.sourceId, title: item.title, action: 'created' });
    } else if (sameEditorial(existing, values)) {
      results.push({ id: existing.id, sourceId: item.sourceId, title: item.title, action: 'unchanged' });
    } else {
      // Keep the admin's collection choice if they moved it.
      const { collectionId: _c, tenantId: _t, sourceId: _s, ...editorial } = values;
      void _c; void _t; void _s;
      await db.update(slides).set(editorial).where(eq(slides.id, existing.id));
      results.push({ id: existing.id, sourceId: item.sourceId, title: item.title, action: 'updated' });
    }
  }

  let pruned: UpsertResult['pruned'] = [];
  if (prune) {
    const rows = await db
      .update(slides)
      .set({ active: false, updatedAt: new Date(), updatedBy: actor })
      .where(
        and(
          eq(slides.tenantId, tenantId),
          like(slides.sourceId, `${source}:%`),
          eq(slides.active, true),
          notInArray(slides.sourceId, keys),
        ),
      )
      .returning({ id: slides.id, sourceId: slides.sourceId, title: slides.title });
    pruned = rows.map((r) => ({ id: r.id, sourceId: splitSourceKey(r.sourceId).sourceId ?? '', title: r.title }));
  }

  const summary = {
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
    pruned: pruned.length,
  };

  await logAudit({
    tenantId,
    userId: actor,
    action: auditAction,
    targetType: 'source',
    targetId: source,
    metadata: { ...summary, publish, sourceIds: request.slides.map((s) => s.sourceId) },
  });

  const changed = summary.created + summary.updated + summary.pruned > 0;
  let published = false;
  if (publish && changed) {
    await publishPlaylist(tenantId, actor, 'ingest');
    published = true;
  }

  return { source, results, pruned, summary, published };
}

export class IngestError extends Error {
  status = 400;
}

// ─── Template catalog (for clients building payloads) ────────────────────────

export const TEMPLATE_CATALOG = [
  {
    templateType: 'general',
    label: 'General Announcement',
    defaultDurationSec: 18,
    viaIngest: true,
    fields: {
      headline: 'Event or announcement name. Under ~50 characters.',
      meta: 'One line: day, time, place. Optional.',
      body: 'The announcement text as written. Plain text, blank line between paragraphs, "- " bullets, **bold**.',
      cta: 'Call to action sentence on its own bold line. Optional.',
      ctaUrl: 'https link shown as a QR code. Optional.',
      eventDate: 'YYYY-MM-DD. Optional.',
      textMode: '"dark" (default) or "light".',
    },
  },
  {
    templateType: 'welcome_quote',
    label: 'Welcome Quote',
    defaultDurationSec: 12,
    viaIngest: true,
    fields: { quote: 'The quotation.', attribution: 'Who said it. Optional.' },
  },
  { templateType: 'parish_identity', label: 'Parish Identity', defaultDurationSec: 10, viaIngest: false, fields: {} },
  { templateType: 'mass_schedule', label: 'Mass Intentions', defaultDurationSec: 22, viaIngest: false, fields: {} },
  { templateType: 'weekly_association', label: 'Weekly Mass Association', defaultDurationSec: 18, viaIngest: false, fields: {} },
  { templateType: 'sanctuary_candle', label: 'Sanctuary Candle', defaultDurationSec: 20, viaIngest: false, fields: {} },
  { templateType: 'app_promo', label: 'App Promo', defaultDurationSec: 15, viaIngest: false, fields: {} },
  { templateType: 'poster', label: 'Poster / Flyer', defaultDurationSec: 15, viaIngest: false, fields: {} },
] as const;
