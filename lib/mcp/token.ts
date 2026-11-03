import { timingSafeEqual } from 'node:crypto';

/** Constant-time compare of a presented token against a configured one.
 *  False when the server has no token configured, so an unset env var
 *  closes the door rather than opening it. */
export function tokenMatches(given: string | null | undefined, expected: string | undefined): boolean {
  if (!given || !expected || expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}
