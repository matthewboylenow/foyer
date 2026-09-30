import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { playlistSnapshots, slides } from '@/lib/db/schema';
import type { PlaylistSnapshot, Slide, SnapshotSlide } from '@/lib/db/schema';

/**
 * "Publish to screens."
 *
 * Edits in the admin are staged. Publishing copies every active slide into
 * a snapshot row; the player serves the latest snapshot (see
 * lib/db/queries.ts getEligibleSlides), filtering by schedule dates at serve
 * time so dated slides still fall off on their own. Before the first
 * publish there is no snapshot and the player serves the live rows.
 */

export type PublishReason = 'manual' | 'takeover' | 'import' | 'editor';

const KEEP_SNAPSHOTS = 20;

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function toSnapshotSlide(s: Slide): SnapshotSlide {
  return {
    ...s,
    startAt: iso(s.startAt),
    endAt: iso(s.endAt),
    createdAt: iso(s.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(s.updatedAt) ?? new Date().toISOString(),
  };
}

/** Fingerprint of every tenant slide (active or not): id:updatedAt. */
export async function computeSourceHash(tenantId: string): Promise<string> {
  const [row] = await db
    .select({
      hash: sql<string>`md5(coalesce(string_agg(${slides.id}::text || ':' || ${slides.updatedAt}::text, ',' ORDER BY ${slides.id}), ''))`,
    })
    .from(slides)
    .where(eq(slides.tenantId, tenantId));
  return row?.hash ?? '';
}

export async function getLatestSnapshot(tenantId: string): Promise<PlaylistSnapshot | undefined> {
  return db.query.playlistSnapshots.findFirst({
    where: eq(playlistSnapshots.tenantId, tenantId),
    orderBy: [desc(playlistSnapshots.publishedAt)],
  });
}

/** Cheap: just the id/time of the latest snapshot, no JSON. */
export async function getLatestSnapshotMeta(tenantId: string) {
  const [row] = await db
    .select({
      id: playlistSnapshots.id,
      publishedAt: playlistSnapshots.publishedAt,
      publishedBy: playlistSnapshots.publishedBy,
      reason: playlistSnapshots.reason,
      sourceHash: playlistSnapshots.sourceHash,
      slideCount: playlistSnapshots.slideCount,
    })
    .from(playlistSnapshots)
    .where(eq(playlistSnapshots.tenantId, tenantId))
    .orderBy(desc(playlistSnapshots.publishedAt))
    .limit(1);
  return row;
}

export async function publishPlaylist(
  tenantId: string,
  by: string | null,
  reason: PublishReason = 'manual',
): Promise<PlaylistSnapshot> {
  const [rows, sourceHash] = await Promise.all([
    db.query.slides.findMany({ where: and(eq(slides.tenantId, tenantId), eq(slides.active, true)) }),
    computeSourceHash(tenantId),
  ]);
  const snapshotSlides = rows.map(toSnapshotSlide);

  const [created] = await db
    .insert(playlistSnapshots)
    .values({
      tenantId,
      publishedBy: by,
      reason,
      sourceHash,
      slides: snapshotSlides,
      slideCount: snapshotSlides.length,
    })
    .returning();

  // Keep the history short — each row carries the whole playlist.
  const keep = await db
    .select({ publishedAt: playlistSnapshots.publishedAt })
    .from(playlistSnapshots)
    .where(eq(playlistSnapshots.tenantId, tenantId))
    .orderBy(desc(playlistSnapshots.publishedAt))
    .limit(KEEP_SNAPSHOTS);
  const oldest = keep[keep.length - 1]?.publishedAt;
  if (oldest && keep.length === KEEP_SNAPSHOTS) {
    await db
      .delete(playlistSnapshots)
      .where(and(eq(playlistSnapshots.tenantId, tenantId), lt(playlistSnapshots.publishedAt, oldest)));
  }

  return created;
}

export interface SlideChange {
  id: string;
  title: string;
  kind: 'added' | 'changed' | 'removed' | 'turned off' | 'turned on';
}

export interface PublishStatus {
  /** null until the first publish (screens are serving live rows). */
  publishedAt: string | null;
  publishedBy: string | null;
  reason: string | null;
  slideCount: number;
  dirty: boolean;
  changes: SlideChange[];
}

/**
 * What differs between the live rows and what the screens are playing.
 * Only active slides matter for playback, so an inactive slide that was
 * edited doesn't count; turning a slide on or off does.
 */
export async function getPublishStatus(tenantId: string): Promise<PublishStatus> {
  const snapshot = await getLatestSnapshot(tenantId);
  const live = await db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    columns: { id: true, title: true, active: true, updatedAt: true },
  });

  if (!snapshot) {
    return {
      publishedAt: null,
      publishedBy: null,
      reason: null,
      slideCount: 0,
      dirty: true,
      changes: [],
    };
  }

  const published = new Map(snapshot.slides.map((s) => [s.id, s]));
  const changes: SlideChange[] = [];
  for (const s of live) {
    const p = published.get(s.id);
    if (s.active && !p) changes.push({ id: s.id, title: s.title, kind: 'turned on' });
    else if (!s.active && p) changes.push({ id: s.id, title: s.title, kind: 'turned off' });
    else if (s.active && p && new Date(s.updatedAt).toISOString() !== p.updatedAt) {
      changes.push({ id: s.id, title: s.title, kind: 'changed' });
    }
  }
  const liveIds = new Set(live.map((s) => s.id));
  for (const p of snapshot.slides) {
    if (!liveIds.has(p.id)) changes.push({ id: p.id, title: p.title, kind: 'removed' });
  }
  // "turned on" for a slide created after the publish reads better as "added".
  for (const c of changes) {
    if (c.kind === 'turned on') {
      const row = live.find((s) => s.id === c.id);
      if (row && new Date(row.updatedAt) > new Date(snapshot.publishedAt)) c.kind = 'added';
    }
  }

  return {
    publishedAt: new Date(snapshot.publishedAt).toISOString(),
    publishedBy: snapshot.publishedBy,
    reason: snapshot.reason,
    slideCount: snapshot.slideCount,
    dirty: changes.length > 0,
    changes,
  };
}

/** Schedule check shared by live rows and snapshot rows. */
export function isWithinSchedule(
  s: { scheduleType: string; startAt: Date | string | null; endAt: Date | string | null },
  now: Date,
): boolean {
  if (s.scheduleType !== 'dated') return true;
  const start = s.startAt ? new Date(s.startAt) : null;
  const end = s.endAt ? new Date(s.endAt) : null;
  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}
