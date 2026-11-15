import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import type {
  MassScheduleContent,
  MassScheduleRow,
  SanctuaryCandleContent,
  Slide,
  WeeklyAssociationContent,
} from '@/lib/db/schema';
import { logAudit } from '@/lib/auth/session';
import { publishPlaylist, type PublishReason } from '@/lib/publish';
import { parseWeekendMass } from '@/lib/parsers/weekendMass';
import { parseWeekdayMass } from '@/lib/parsers/weekdayMass';

/**
 * The weekly bulletin → the three parish slides.
 *
 * The parish publishes its bulletin as a two-sheet PDF (each sheet is two
 * letter pages side by side). One column holds, under letter-spaced
 * headings, exactly what the "This week" page asks for:
 *
 *   M A S S   I N T E N T I O N S
 *   W E E K E N D   O F   N O V E M B E R   1 4 / 1 5
 *   5:00pm - Name
 *   …
 *   D A I L Y   M A S S
 *   Nov 16 - Name
 *   …
 *   W E E K L Y   M A S S   A S S O C I A T I O N
 *   Name, Name, Name …
 *   S A N C T U A R Y   C A N D L E
 *   Name
 *
 * pdf.js (via unpdf) returns that column as contiguous lines, so the parse
 * is deterministic: find the headings, hand each block to the same parsers
 * the paste boxes use. No model call, no API key.
 */

/** Where the parish lists its bulletins; the newest PDF is linked from here. */
export const BULLETIN_INDEX_URL = process.env.BULLETIN_INDEX_URL || 'https://sainthelen.org/bulletin/';
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export interface ParishSection {
  found: boolean;
  weekendLabel: string | null;
  weekendRows: MassScheduleRow[];
  weekdayRows: MassScheduleRow[];
  associationNames: string[];
  candle: { name: string; inMemoryOf: boolean } | null;
  warnings: string[];
}

export interface BulletinRead extends ParishSection {
  sourceUrl: string | null;
  /** From the filename (Saint-Helen-Bulletin-MMDDYYYY.pdf) when present. */
  bulletinDate: string | null;
  pages: number;
}

// ─── Finding and fetching ────────────────────────────────────────────────────

const BULLETIN_FILE_RE = /Saint-Helen-Bulletin-(\d{2})(\d{2})(\d{4})\.pdf/i;

/** Pick the newest bulletin PDF linked from the bulletin page's HTML. */
export function pickLatestBulletinUrl(html: string, base = BULLETIN_INDEX_URL): string | null {
  const urls = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)) {
    try {
      urls.add(new URL(m[1], base).toString());
    } catch {
      /* skip malformed */
    }
  }
  const dated = [...urls]
    .map((u) => ({ u, d: bulletinDateFromUrl(u) }))
    .filter((x): x is { u: string; d: string } => !!x.d)
    .sort((a, b) => (a.d < b.d ? 1 : -1));
  if (dated.length > 0) return dated[0].u;
  // No dated filename: fall back to the page's featured link, if any.
  const cta = /class="sh-bul__cta"[^>]*href="([^"]+)"/i.exec(html) ?? /href="([^"]+)"[^>]*class="sh-bul__cta"/i.exec(html);
  return cta ? new URL(cta[1], base).toString() : null;
}

export function bulletinDateFromUrl(url: string): string | null {
  const m = BULLETIN_FILE_RE.exec(url);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/** We identify ourselves honestly. If the parish site's bot protection
 *  answers with a browser check instead of the page, we say so and leave
 *  it to the site owner to allow this user agent; the admin can upload the
 *  PDF, and the MCP tool accepts the page text, in the meantime. */
export const FOYER_USER_AGENT = 'Foyer/1.0 (+https://github.com/matthewboylenow/foyer; bulletin import)';

export const BOT_CHECK_MESSAGE =
  'The parish website answered with a browser check instead of the bulletin. Allow the "Foyer/1.0" user agent in the site\'s firewall, or upload the PDF on the "This week" page (the MCP read_bulletin tool also accepts the page text).';

function looksLikeBotCheck(html: string): boolean {
  return /<title>\s*(?:One moment|Just a moment|Attention Required)/i.test(html) || /cf-chl|challenge-platform/i.test(html);
}

export async function findLatestBulletinUrl(): Promise<string | null> {
  const res = await fetch(BULLETIN_INDEX_URL, { headers: { 'user-agent': FOYER_USER_AGENT }, cache: 'no-store' });
  const html = await res.text();
  if (res.status === 403 || res.status === 503 || looksLikeBotCheck(html)) throw new Error(BOT_CHECK_MESSAGE);
  if (!res.ok) throw new Error(`Bulletin page returned ${res.status}`);
  return pickLatestBulletinUrl(html);
}

export async function fetchBulletinPdf(url: string): Promise<Uint8Array> {
  if (!/^https:\/\//i.test(url)) throw new Error('Bulletin URL must be https.');
  const res = await fetch(url, { headers: { 'user-agent': FOYER_USER_AGENT }, cache: 'no-store' });
  if (res.status === 403 || res.status === 503) throw new Error(BOT_CHECK_MESSAGE);
  if (!res.ok) throw new Error(`Bulletin download returned ${res.status}`);
  if (/text\/html/i.test(res.headers.get('content-type') ?? '')) throw new Error(BOT_CHECK_MESSAGE);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_PDF_BYTES) throw new Error('Bulletin PDF is too large.');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF_BYTES) throw new Error('Bulletin PDF is too large.');
  return buf;
}

/** Text of every page, in pdf.js reading order. */
export async function extractPdfText(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** "M A S S   I N T E N T I O N S" → "MASSINTENTIONS" */
function flat(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** A letter-spaced heading line ("S A N C T U A R Y   C A N D L E"), possibly
 *  with normal text glued to its end ("W A Y S   T O   G I V EOnline"). */
function looksLikeHeading(line: string): boolean {
  return /^(?:\S ){4,}/.test(line.trim());
}

const HEADINGS = {
  intentions: 'MASSINTENTIONS',
  daily: 'DAILYMASS',
  association: 'WEEKLYMASSASSOCIATION',
  candle: 'SANCTUARYCANDLE',
} as const;

function headingKind(line: string): keyof typeof HEADINGS | null {
  const f = flat(line);
  for (const [k, v] of Object.entries(HEADINGS)) if (f.startsWith(v)) return k as keyof typeof HEADINGS;
  return null;
}

const MONTHS: Record<string, string> = {
  JANUARY: 'January', FEBRUARY: 'February', MARCH: 'March', APRIL: 'April', MAY: 'May', JUNE: 'June',
  JULY: 'July', AUGUST: 'August', SEPTEMBER: 'September', OCTOBER: 'October', NOVEMBER: 'November', DECEMBER: 'December',
};

/** "WEEKENDOFNOVEMBER14/15" → "Weekend of November 14 / 15" */
function prettyWeekendLabel(flatLabel: string): string {
  const m = /^WEEKENDOF([A-Z]+)(\d{1,2})\/(?:([A-Z]+))?(\d{1,2})$/.exec(flatLabel);
  if (!m) return flatLabel.replace(/^WEEKENDOF/, 'Weekend of ');
  const m1 = MONTHS[m[1]] ?? m[1];
  const m2 = m[3] ? ` ${MONTHS[m[3]] ?? m[3]}` : '';
  return `Weekend of ${m1} ${m[2]} /${m2} ${m[4]}`;
}

/**
 * The weekend label is letter-spaced and the first Mass row is often glued
 * to its end: "W E E K E N D   O F   N O V E M B E R   1 4 / 1 55:00pm - Name".
 * Split them: the spaced prefix is the label; if what follows starts with a
 * digit immediately followed by a time, that digit belongs to the label.
 */
export function splitWeekendLabelLine(line: string): { label: string; rest: string } {
  const m = /^((?:\S ){5,})(.*)$/.exec(line.trim());
  if (!m) return { label: flat(line), rest: '' };
  let label = m[1].replace(/\s+/g, '');
  let rest = m[2];
  const glued = /^(\d)((?:1[0-2]|[1-9]):[0-5]\d\s*(?:am|pm)\b.*)$/i.exec(rest);
  if (glued) {
    label += glued[1];
    rest = glued[2];
  } else if (rest.length === 1) {
    label += rest;
    rest = '';
  } else if (!/^(?:1[0-2]|[1-9]):[0-5]\d/.test(rest)) {
    // Not a Mass row: the whole thing was the label.
    label += rest.replace(/\s+/g, '');
    rest = '';
  }
  return { label: label.toUpperCase(), rest: rest.trim() };
}

/** Parse the Mass intentions column out of bulletin text (one page or all). */
export function parseParishSection(text: string): ParishSection {
  const out: ParishSection = {
    found: false,
    weekendLabel: null,
    weekendRows: [],
    weekdayRows: [],
    associationNames: [],
    candle: null,
    warnings: [],
  };
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => headingKind(l) === 'intentions');
  if (start < 0) {
    out.warnings.push('Could not find the "Mass Intentions" heading in the bulletin text.');
    return out;
  }
  out.found = true;

  type Mode = 'weekend' | 'weekday' | 'association' | 'candle' | 'done';
  let mode: Mode = 'weekend';
  const weekend: string[] = [];
  const weekday: string[] = [];
  const assoc: string[] = [];
  const candle: string[] = [];

  for (let i = start + 1; i < lines.length && mode !== 'done'; i++) {
    const line = lines[i];
    if (!line) continue;
    const kind = headingKind(line);
    if (kind === 'daily') { mode = 'weekday'; continue; }
    if (kind === 'association') { mode = 'association'; continue; }
    if (kind === 'candle') { mode = 'candle'; continue; }
    if (flat(line).startsWith('WEEKENDOF')) {
      const { label, rest } = splitWeekendLabelLine(line);
      out.weekendLabel = prettyWeekendLabel(label);
      if (rest) weekend.push(rest);
      continue;
    }
    if (looksLikeHeading(line)) {
      // Any other heading ends the column we care about.
      if (mode === 'candle' || mode === 'association') mode = 'done';
      else if (mode !== 'weekend' && mode !== 'weekday') mode = 'done';
      continue;
    }
    if (mode === 'weekend') weekend.push(line);
    else if (mode === 'weekday') weekday.push(line);
    else if (mode === 'association') assoc.push(line);
    else if (mode === 'candle') {
      candle.push(line);
      if (candle.length >= 2) mode = 'done';
    }
  }

  const we = parseWeekendMass(weekend.join('\n'));
  out.weekendRows = we.rows.filter((r): r is MassScheduleRow & { needsReview: boolean } => 'timeLabel' in r).map(({ timeLabel, intention }) => ({ timeLabel, intention }));
  out.warnings.push(...we.warnings.map((w) => `Weekend: ${w.raw} (${w.reason})`));

  const wd = parseWeekdayMass(weekday.join('\n'));
  out.weekdayRows = wd.rows.filter((r): r is MassScheduleRow & { needsReview: boolean } => 'timeLabel' in r).map(({ timeLabel, intention }) => ({ timeLabel, intention }));
  out.warnings.push(...wd.warnings.map((w) => `Daily: ${w.raw} (${w.reason})`));

  out.associationNames = assoc
    .join(' ')
    .split(/,|;|\s+and\s+|\s+&\s+(?=[A-Z][a-z]+\s+[A-Z])/)
    .map((n) => n.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const candleText = candle.join(' ').replace(/\s+/g, ' ').trim();
  if (candleText) {
    const honor = /^in\s+honou?r\s+of\s+/i.test(candleText);
    const name = candleText.replace(/^in\s+(?:memory|honou?r)\s+of\s+/i, '').trim();
    out.candle = { name, inMemoryOf: !honor };
  }

  if (out.weekendRows.length === 0) out.warnings.push('No weekend Mass rows were recognized.');
  if (out.weekdayRows.length === 0) out.warnings.push('No daily Mass rows were recognized.');
  if (out.associationNames.length === 0) out.warnings.push('No Mass association names were recognized.');
  if (!out.candle) out.warnings.push('No sanctuary candle name was recognized.');
  return out;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/**
 * Read the parish section from a bulletin: by URL, from the newest one on
 * the parish site when no URL is given, or from text already extracted.
 */
export async function readBulletin(
  input: { url?: string | null; text?: string | null; pdf?: Uint8Array | null } = {},
): Promise<BulletinRead> {
  if (input.text?.trim()) {
    return { ...parseParishSection(input.text), sourceUrl: null, bulletinDate: null, pages: 0 };
  }
  if (input.pdf && input.pdf.byteLength > 0) {
    const pages = await extractPdfText(input.pdf);
    const page = pages.find((p) => parseParishSection(p).found) ?? pages.join('\n');
    return { ...parseParishSection(page), sourceUrl: null, bulletinDate: null, pages: pages.length };
  }
  const url = input.url?.trim() || (await findLatestBulletinUrl());
  if (!url) throw new Error('No bulletin PDF found on the parish site.');
  const pages = await extractPdfText(await fetchBulletinPdf(url));
  const page = pages.find((p) => parseParishSection(p).found) ?? pages.join('\n');
  return { ...parseParishSection(page), sourceUrl: url, bulletinDate: bulletinDateFromUrl(url), pages: pages.length };
}

// ─── Applying to the three slides ────────────────────────────────────────────

export interface ParishUpdate {
  weekendLabel?: string | null;
  weekendRows?: MassScheduleRow[];
  weekdayRows?: MassScheduleRow[];
  associationNames?: string[];
  candle?: { name: string; inMemoryOf: boolean } | null;
}

export interface ParishApplyResult {
  updated: { slide: 'intentions' | 'association' | 'candle'; id: string; created: boolean }[];
  skipped: ('intentions' | 'association' | 'candle')[];
  published: boolean;
}

type ParishTemplate = 'mass_schedule' | 'weekly_association' | 'sanctuary_candle';

async function pickSlide(tenantId: string, templateType: ParishTemplate): Promise<Slide | null> {
  const rows = await db.query.slides.findMany({
    where: and(eq(slides.tenantId, tenantId), eq(slides.templateType, templateType)),
    orderBy: [desc(slides.active), desc(slides.updatedAt)],
    limit: 1,
  });
  return rows[0] ?? null;
}

async function upsertParishSlide(
  tenantId: string,
  templateType: ParishTemplate,
  title: string,
  build: (existing: Record<string, unknown>) => Record<string, unknown>,
  actor: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await pickSlide(tenantId, templateType);
  const base = (existing?.content && typeof existing.content === 'object' ? existing.content : { templateType }) as Record<string, unknown>;
  const content = { ...build(base), templateType };
  if (existing) {
    await db.update(slides).set({ content, updatedAt: new Date(), updatedBy: actor }).where(eq(slides.id, existing.id));
    return { id: existing.id, created: false };
  }
  const [row] = await db
    .insert(slides)
    .values({
      tenantId,
      templateType,
      title,
      content,
      contentLandscape: null,
      scheduleType: 'evergreen',
      active: true,
      pin: 'end',
      priority: false,
      weight: 1,
      targetDisplays: [],
      displayOrder: 0,
      createdBy: actor,
      updatedBy: actor,
    })
    .returning({ id: slides.id });
  return { id: row.id, created: true };
}

/**
 * Write whichever parts are given onto the three parish slides, the same
 * way the "This week" page saves them. Sections not given are left alone.
 */
export async function applyParishUpdate(
  tenantId: string,
  update: ParishUpdate,
  actor: string,
  opts: { publish?: boolean; auditAction: string; reason?: PublishReason; source?: string | null } = { auditAction: 'parish.update' },
): Promise<ParishApplyResult> {
  const result: ParishApplyResult = { updated: [], skipped: [], published: false };

  const hasIntentions = update.weekendLabel !== undefined || update.weekendRows !== undefined || update.weekdayRows !== undefined;
  if (hasIntentions) {
    const r = await upsertParishSlide(tenantId, 'mass_schedule', 'Mass Intentions', (c) => {
      const next: MassScheduleContent = {
        ...(c as MassScheduleContent),
        templateType: 'mass_schedule',
        weekendLabel: update.weekendLabel === undefined ? (c.weekendLabel as string | undefined) : update.weekendLabel ?? undefined,
        weekendRows: update.weekendRows ?? (c.weekendRows as MassScheduleRow[] | undefined) ?? [],
        weekdayRows: update.weekdayRows ?? (c.weekdayRows as MassScheduleRow[] | undefined) ?? [],
        scheduleKind: undefined,
        rows: undefined,
      };
      return next as unknown as Record<string, unknown>;
    }, actor);
    result.updated.push({ slide: 'intentions', ...r });
  } else result.skipped.push('intentions');

  if (update.associationNames !== undefined) {
    const r = await upsertParishSlide(tenantId, 'weekly_association', 'Weekly Mass Association', (c) => {
      const next: WeeklyAssociationContent = { ...(c as WeeklyAssociationContent), templateType: 'weekly_association', names: update.associationNames ?? [] };
      return next as unknown as Record<string, unknown>;
    }, actor);
    result.updated.push({ slide: 'association', ...r });
  } else result.skipped.push('association');

  if (update.candle) {
    const candle = update.candle;
    const r = await upsertParishSlide(tenantId, 'sanctuary_candle', 'Sanctuary Candle', (c) => {
      const next: SanctuaryCandleContent = { ...(c as SanctuaryCandleContent), templateType: 'sanctuary_candle', name: candle.name, inMemoryOf: candle.inMemoryOf };
      return next as unknown as Record<string, unknown>;
    }, actor);
    result.updated.push({ slide: 'candle', ...r });
  } else result.skipped.push('candle');

  await logAudit({
    tenantId,
    userId: actor,
    action: opts.auditAction,
    targetType: 'parish',
    targetId: opts.source ?? undefined,
    metadata: {
      updated: result.updated.map((u) => u.slide),
      weekendLabel: update.weekendLabel ?? null,
      weekendRows: update.weekendRows?.length ?? null,
      weekdayRows: update.weekdayRows?.length ?? null,
      names: update.associationNames?.length ?? null,
      candle: update.candle?.name ?? null,
      publish: !!opts.publish,
    },
  });

  if (opts.publish && result.updated.length > 0) {
    await publishPlaylist(tenantId, actor, opts.reason ?? 'import');
    result.published = true;
  }
  return result;
}
