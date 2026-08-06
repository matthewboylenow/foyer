import { revalidateTag } from 'next/cache';

/**
 * One tag covers everything a TV display renders: eligible slides, display
 * config, tenant row, and tenant settings/theme. Display-facing reads are
 * cached under this tag (with a revalidate window as a safety net) and any
 * admin mutation that could change what plays calls
 * `revalidateDisplayContent()` — so edits still reach screens on their next
 * poll, but steady-state polling never touches Postgres. This is what lets
 * Neon's compute idle instead of running (and billing) 24/7.
 */
export const DISPLAY_CONTENT_TAG = 'display-content';

export function revalidateDisplayContent() {
  revalidateTag(DISPLAY_CONTENT_TAG);
}
