import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import type { Slide } from '@/lib/db/schema';
import { logAudit } from '@/lib/auth/session';
import { publishPlaylist, type PublishReason } from '@/lib/publish';

/**
 * Two housekeeping jobs around announcement slides:
 *   - spotting a proposed announcement that is already on the screens, so
 *     a bulletin import does not add a twin of an email-import slide;
 *   - retiring announcements whose dates have passed, so the Slides page
 *     is not full of stale "on" slides (the player already hides them).
 */

/** Templates that are announcements (not the pinned parish slides). */
export const ANNOUNCEMENT_TEMPLATES = new Set(['general', 'poster', 'welcome_quote']);

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'with', 'for', 'to', 'in', 'on', 'at', 'our', 'this', 'your', 'from', 'by']);

export function normalizeHeading(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeHeading(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
}

export interface Proposed {
  heading: string;
  eventDate?: string;
}

export interface Existing {
  id: string;
  title: string;
  headline?: string | null;
  eventDate?: string | null;
}

/** Same announcement? Equal or nested headings, or most words shared on
 *  the same date (or when either side has no date). */
export function isSameAnnouncement(item: Proposed, slide: Existing): boolean {
  const a = normalizeHeading(item.heading);
  const b = normalizeHeading(slide.headline || slide.title);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  const overlap = shared / Math.min(ta.size, tb.size);
  const datesAgree = !item.eventDate || !slide.eventDate || item.eventDate === slide.eventDate;
  return overlap >= 0.6 && datesAgree;
}

export function findDuplicates<T extends Proposed>(items: T[], existing: Existing[]): Map<number, Existing> {
  const out = new Map<number, Existing>();
  items.forEach((item, i) => {
    const hit = existing.find((s) => isSameAnnouncement(item, s));
    if (hit) out.set(i, hit);
  });
  return out;
}

export function slideToExisting(s: Slide): Existing {
  const c = (s.content ?? {}) as Record<string, unknown>;
  return {
    id: s.id,
    title: s.title,
    headline: typeof c.headline === 'string' ? c.headline : typeof c.quote === 'string' ? c.quote : null,
    eventDate: typeof c.eventDate === 'string' ? c.eventDate : null,
  };
}

export async function loadActiveAnnouncements(tenantId: string): Promise<Slide[]> {
  const rows = await db.query.slides.findMany({ where: and(eq(slides.tenantId, tenantId), eq(slides.active, true)) });
  return rows.filter((s) => ANNOUNCEMENT_TEMPLATES.has(s.templateType));
}

// ─── Retiring past announcements ─────────────────────────────────────────────

/** Today's date in the parish's time zone, YYYY-MM-DD. */
export function todayYmd(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * An announcement is past when its end date has gone by, or, with no end
 * date, when its event date is before today. Pinned, takeover and parish
 * slides are never retired here.
 */
export function isPastAnnouncement(
  s: Pick<Slide, 'active' | 'pin' | 'priority' | 'templateType' | 'scheduleType' | 'endAt' | 'content'>,
  now = new Date(),
): boolean {
  if (!s.active || s.pin || s.priority) return false;
  if (!ANNOUNCEMENT_TEMPLATES.has(s.templateType)) return false;
  if (s.endAt) return new Date(s.endAt).getTime() < now.getTime();
  const eventDate = (s.content as { eventDate?: unknown } | null)?.eventDate;
  if (typeof eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return eventDate < todayYmd(now);
  return false;
}

export interface RetireResult {
  retired: { id: string; title: string; endAt: string | null; eventDate: string | null }[];
  dryRun: boolean;
  published: boolean;
}

export async function retirePastAnnouncements(
  tenantId: string,
  actor: string,
  opts: { dryRun?: boolean; publish?: boolean; auditAction: string; reason?: PublishReason; now?: Date },
): Promise<RetireResult> {
  const now = opts.now ?? new Date();
  const active = await db.query.slides.findMany({
    where: and(eq(slides.tenantId, tenantId), eq(slides.active, true), isNull(slides.pin)),
  });
  const past = active.filter((s) => isPastAnnouncement(s, now));
  const retired = past.map((s) => ({
    id: s.id,
    title: s.title,
    endAt: s.endAt ? new Date(s.endAt).toISOString() : null,
    eventDate: ((s.content as { eventDate?: string } | null)?.eventDate as string | undefined) ?? null,
  }));
  if (opts.dryRun || past.length === 0) return { retired, dryRun: !!opts.dryRun, published: false };

  for (const s of past) {
    await db.update(slides).set({ active: false, updatedAt: now, updatedBy: actor }).where(eq(slides.id, s.id));
  }
  await logAudit({
    tenantId,
    userId: actor,
    action: opts.auditAction,
    targetType: 'slides',
    metadata: { retired: retired.map((r) => r.title), count: retired.length, publish: !!opts.publish },
  });
  let published = false;
  if (opts.publish) {
    await publishPlaylist(tenantId, actor, opts.reason ?? 'import');
    published = true;
  }
  return { retired, dryRun: false, published };
}
