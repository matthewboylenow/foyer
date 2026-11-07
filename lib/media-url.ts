/**
 * Where a media file lives. Two kinds are accepted:
 *   - bundled: shipped in public/media and served from the app's own CDN
 *     ("/media/advent-glow-joy-candle.jpg"); counts as ordinary (included)
 *     data transfer, never Blob transfer.
 *   - blob: uploaded through the admin to this project's Vercel Blob store.
 */
export function isBundledMediaUrl(url: string): boolean {
  return /^\/media\/[a-z0-9][a-z0-9._-]*$/i.test(url);
}

export function isBlobMediaUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i.test(url);
}

export function isOwnMediaUrl(url: string): boolean {
  return isBundledMediaUrl(url) || isBlobMediaUrl(url);
}
