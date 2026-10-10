import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { GeneralContent, PosterContent, SourceItem } from '@/lib/db/schema';

/**
 * WordPress → Foyer sync: the pure parts. Signature verification, payload
 * validation, content normalization, and the per-item decision
 * (create / update / unchanged / stale / withdraw). No database access
 * here so every rule is unit-testable; app/api/sources/wordpress/route.ts
 * does the I/O.
 *
 * Contract: see docs/wordpress-sync.md.
 */

export const SOURCE = 'wordpress';
export const SIGNATURE_HEADER = 'x-foyer-signature';
export const TIMESTAMP_HEADER = 'x-foyer-timestamp';
export const DELIVERY_HEADER = 'x-foyer-delivery';
/** Reject deliveries whose timestamp is further than this from now. */
export const MAX_CLOCK_SKEW_SEC = 300;
export const MAX_ITEMS_PER_DELIVERY = 50;
export const MAX_BODY_BYTES = 512 * 1024;

// ─── Signature ───────────────────────────────────────────────────────────────

/** HMAC-SHA256 over `${timestamp}.${rawBody}`, hex, sent as "sha256=<hex>". */
export function signBody(rawBody: string, timestamp: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `sha256=${mac}`;
}

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'malformed' | 'stale_timestamp' | 'mismatch' };

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
  now: number = Date.now(),
): SignatureCheck {
  if (!signatureHeader || !timestampHeader) return { ok: false, reason: 'missing' };
  if (!/^\d{9,11}$/.test(timestampHeader)) return { ok: false, reason: 'malformed' };
  const ts = parseInt(timestampHeader, 10) * 1000;
  if (Math.abs(now - ts) > MAX_CLOCK_SKEW_SEC * 1000) return { ok: false, reason: 'stale_timestamp' };
  const m = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!m) return { ok: false, reason: 'malformed' };
  const expected = signBody(rawBody, timestampHeader, secret).slice('sha256='.length);
  const a = Buffer.from(m[1].toLowerCase(), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

// ─── Payload ─────────────────────────────────────────────────────────────────

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => /^https:\/\/[^\s]+$/i.test(u), 'must be an https URL');

const isoDate = z.string().datetime({ offset: true });
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const WordPressItemSchema = z
  .object({
    /** WordPress post ID (or any stable string id). */
    sourceId: z.string().trim().min(1).max(64),
    /** Monotonic per item. Use the post's modified time as epoch seconds. */
    revision: z.number().int().nonnegative(),
    status: z.enum(['active', 'withdrawn']),
    kind: z.enum(['announcement', 'event', 'poster']).default('announcement'),
    title: z.string().trim().min(1).max(200),
    /** Shown as the headline; defaults to title. */
    heading: z.string().trim().max(200).optional(),
    /** Date · time · place line. */
    subtitle: z.string().trim().max(200).optional(),
    /** Paragraphs, plain text (no HTML). Rendered one <p> each. */
    paragraphs: z.array(z.string().max(2000)).max(20).default([]),
    /** Call-to-action sentence, rendered on its own line. */
    cta: z.string().trim().max(300).optional(),
    ctaUrl: httpsUrl.optional(),
    eventDate: ymd.optional(),
    /** Poster kind only: the flyer image. Public https URL. */
    imageUrl: httpsUrl.optional(),
    /** Playback window. Omit both for evergreen. */
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    /** Link back to the WordPress item, for the admin. */
    sourceUrl: httpsUrl.optional(),
    sourceUpdatedAt: isoDate.optional(),
  })
  .strict();

export const WordPressDeliverySchema = z
  .object({
    source: z.literal(SOURCE),
    /** Tenant slug the sender believes it is talking to; must match the
     *  tenant resolved from the request host. */
    tenant: z.string().trim().min(1).max(64),
    deliveryId: z.string().trim().max(128).optional(),
    items: z.array(WordPressItemSchema).min(1).max(MAX_ITEMS_PER_DELIVERY),
  })
  .strict();

export type WordPressItem = z.infer<typeof WordPressItemSchema>;
export type WordPressDelivery = z.infer<typeof WordPressDeliverySchema>;

// ─── Normalization ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The editorial fields that the sync owns — everything the hash covers. */
export interface NormalizedItem {
  status: 'active' | 'withdrawn';
  kind: string;
  templateType: 'general' | 'poster';
  title: string;
  content: GeneralContent | PosterContent;
  imageUrl: string | null;
  scheduleType: 'evergreen' | 'dated';
  startAt: Date | null;
  endAt: Date | null;
  sourceUrl: string | null;
  sourceUpdatedAt: Date | null;
  payloadHash: string;
}

export function normalizeItem(item: WordPressItem): NormalizedItem {
  const isPoster = item.kind === 'poster' && !!item.imageUrl;
  const templateType: 'general' | 'poster' = isPoster ? 'poster' : 'general';

  let content: GeneralContent | PosterContent;
  if (isPoster) {
    content = {
      templateType: 'poster',
      fit: 'contain',
      caption: item.subtitle || item.heading || item.title,
      qrUrl: item.ctaUrl,
      qrLabel: item.ctaUrl ? 'Scan to visit' : undefined,
    };
  } else {
    const paras = item.paragraphs.map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`);
    if (item.cta?.trim()) paras.push(`<p><strong>${esc(item.cta.trim())}</strong></p>`);
    content = {
      templateType: 'general',
      headline: item.heading?.trim() || item.title,
      headlineSize: 'small',
      meta: item.subtitle?.trim() || '',
      body: paras.join(''),
      eventDate: item.eventDate,
      qrUrl: item.ctaUrl,
      qrLabel: item.ctaUrl ? 'Scan to visit' : undefined,
      motionStyle: 'lineMask',
      textMode: 'dark',
    };
  }

  const startAt = item.startAt ? new Date(item.startAt) : null;
  const endAt = item.endAt ? new Date(item.endAt) : null;
  const scheduleType: 'evergreen' | 'dated' = startAt || endAt ? 'dated' : 'evergreen';

  const editorial = {
    status: item.status,
    kind: item.kind,
    templateType,
    title: item.title,
    content,
    imageUrl: isPoster ? item.imageUrl! : null,
    scheduleType,
    startAt: startAt?.toISOString() ?? null,
    endAt: endAt?.toISOString() ?? null,
    sourceUrl: item.sourceUrl ?? null,
  };
  const payloadHash = createHash('md5').update(JSON.stringify(editorial)).digest('hex');

  return {
    ...editorial,
    startAt,
    endAt,
    sourceUpdatedAt: item.sourceUpdatedAt ? new Date(item.sourceUpdatedAt) : null,
    payloadHash,
  };
}

// ─── Per-item decision ───────────────────────────────────────────────────────

export type ItemAction = 'created' | 'updated' | 'unchanged' | 'stale' | 'withdrawn';

export interface ItemPlan {
  action: ItemAction;
  /** Editorial columns to write (null for 'unchanged' / 'stale'). */
  write: (NormalizedItem & { revision: number }) | null;
}

/**
 * Decide what to do with one delivered item given what we already hold.
 * Idempotent: the same (revision, payload) twice is 'unchanged'; a lower
 * revision than stored is 'stale' and ignored; a withdrawn item is written
 * as withdrawn (even if it was never active). Presentation columns are not
 * part of the plan — they are never written by the sync.
 */
export function planItem(
  existing: Pick<SourceItem, 'revision' | 'payloadHash' | 'status'> | null,
  incoming: WordPressItem,
): ItemPlan {
  const normalized = normalizeItem(incoming);
  const write = { ...normalized, revision: incoming.revision };
  if (!existing) {
    return { action: incoming.status === 'withdrawn' ? 'withdrawn' : 'created', write };
  }
  if (incoming.revision < existing.revision) return { action: 'stale', write: null };
  if (incoming.revision === existing.revision && existing.payloadHash === normalized.payloadHash) {
    return { action: 'unchanged', write: null };
  }
  return { action: incoming.status === 'withdrawn' ? 'withdrawn' : 'updated', write };
}

// ─── Serving ─────────────────────────────────────────────────────────────────

export { isSourceItemPlayable } from './playable';
