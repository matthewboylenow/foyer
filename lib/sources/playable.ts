import type { SourceItem } from '@/lib/db/schema';

/**
 * Is this source item eligible for playback right now (ignoring display
 * targeting)? Kept in its own crypto-free module because lib/db/queries.ts
 * imports it and queries.ts is reachable from the Edge middleware bundle
 * (middleware → auth config → otp → queries).
 */
export function isSourceItemPlayable(
  item: Pick<SourceItem, 'status' | 'hidden' | 'scheduleType' | 'startAt' | 'endAt'>,
  now: Date,
): boolean {
  if (item.status !== 'active' || item.hidden) return false;
  if (item.scheduleType === 'dated') {
    if (item.startAt && new Date(item.startAt) > now) return false;
    if (item.endAt && new Date(item.endAt) < now) return false;
  }
  return true;
}
