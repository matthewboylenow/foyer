/**
 * Pure uptime math for the Displays page. No database access here — the
 * functions take offline intervals and return numbers/buckets, so they can
 * be unit-tested and reused by the API and the cron.
 *
 * Model: a display is "up" unless an open or closed outage interval covers
 * the moment in question. Outages come from display_events rows with
 * kind='offline' (`at` = start, `resolvedAt` = end, null = still down).
 */

/** Heartbeat cadence the player runs at (see components/player/Player.tsx). */
export const HEARTBEAT_INTERVAL_SEC = 60;
/** Player status thresholds (seconds since last heartbeat). */
export const ONLINE_WITHIN_SEC = 150;
export const STALE_WITHIN_SEC = 300;
/** A player quiet for longer than this is recorded as an outage. */
export const OFFLINE_AFTER_SEC = STALE_WITHIN_SEC;
/** Agent check-in cadence (see public/pi/foyer-agent.sh) and threshold. */
export const AGENT_INTERVAL_SEC = 60;
export const AGENT_ONLINE_WITHIN_SEC = 180;

export type LiveStatus = 'online' | 'stale' | 'offline';

export interface Outage {
  start: Date;
  /** null = still ongoing */
  end: Date | null;
}

export function playerStatus(lastHeartbeatAt: Date | string | null, now = Date.now()): LiveStatus {
  if (!lastHeartbeatAt) return 'offline';
  const age = (now - new Date(lastHeartbeatAt).getTime()) / 1000;
  if (age <= ONLINE_WITHIN_SEC) return 'online';
  if (age <= STALE_WITHIN_SEC) return 'stale';
  return 'offline';
}

export function agentStatus(agentLastSeenAt: Date | string | null, now = Date.now()): 'online' | 'offline' | 'none' {
  if (!agentLastSeenAt) return 'none';
  const age = (now - new Date(agentLastSeenAt).getTime()) / 1000;
  return age <= AGENT_ONLINE_WITHIN_SEC ? 'online' : 'offline';
}

/** Overlap in ms between an outage and a window [from, to]. */
function overlapMs(o: Outage, from: number, to: number): number {
  const s = Math.max(o.start.getTime(), from);
  const e = Math.min(o.end ? o.end.getTime() : to, to);
  return Math.max(0, e - s);
}

/**
 * Uptime percentage over the window ending at `now`. Time before the
 * display existed (`since`) is excluded from the denominator so a screen
 * added yesterday doesn't show 3% uptime for the month.
 */
export function uptimePercent(
  outages: Outage[],
  windowMs: number,
  opts: { now?: number; since?: Date | null } = {},
): number | null {
  const now = opts.now ?? Date.now();
  const from = Math.max(now - windowMs, opts.since ? opts.since.getTime() : 0);
  const total = now - from;
  if (total <= 0) return null;
  let down = 0;
  for (const o of outages) down += overlapMs(o, from, now);
  const pct = ((total - Math.min(down, total)) / total) * 100;
  return Math.round(pct * 10) / 10;
}

export type BucketState = 'up' | 'down' | 'partial' | 'unknown';

export interface Bucket {
  start: number;
  end: number;
  state: BucketState;
}

/**
 * The UptimeKuma-style history strip. Splits the window into `count`
 * equal buckets and classifies each: 'down' if the display was out for
 * the whole bucket, 'partial' if out for some of it, 'up' otherwise,
 * 'unknown' if the bucket ends before the display existed.
 */
export function historyStrip(
  outages: Outage[],
  windowMs: number,
  count: number,
  opts: { now?: number; since?: Date | null } = {},
): Bucket[] {
  const now = opts.now ?? Date.now();
  const bucketMs = windowMs / count;
  const since = opts.since ? opts.since.getTime() : 0;
  const out: Bucket[] = [];
  for (let i = 0; i < count; i++) {
    const start = now - windowMs + i * bucketMs;
    const end = start + bucketMs;
    if (end <= since) {
      out.push({ start, end, state: 'unknown' });
      continue;
    }
    const effectiveStart = Math.max(start, since);
    const span = end - effectiveStart;
    let down = 0;
    for (const o of outages) down += overlapMs(o, effectiveStart, end);
    down = Math.min(down, span);
    const state: BucketState =
      down <= 0 ? 'up' : down >= span - 1 ? 'down' : 'partial';
    out.push({ start, end, state });
  }
  return out;
}

/** "3m 20s", "2h 5m", "4d 1h" — for outage durations and Pi uptime. */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  const s = Math.floor(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * Decode the Raspberry Pi `vcgencmd get_throttled` bitmask into something
 * a person can act on. Bits 0–3 are "now", 16–19 are "since boot".
 * https://www.raspberrypi.com/documentation/computers/os.html#get_throttled
 */
export function decodeThrottled(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const value = parseInt(raw.replace(/^throttled=/, ''), 16);
  if (!Number.isFinite(value) || value === 0) return [];
  const flags: string[] = [];
  if (value & 0x1) flags.push('Under-voltage now');
  if (value & 0x2) flags.push('Frequency capped now');
  if (value & 0x4) flags.push('Throttled now');
  if (value & 0x8) flags.push('Soft temperature limit now');
  if (value & 0x10000) flags.push('Under-voltage since boot');
  if (value & 0x20000) flags.push('Frequency capped since boot');
  if (value & 0x40000) flags.push('Throttled since boot');
  if (value & 0x80000) flags.push('Soft temperature limit since boot');
  return flags;
}

/** Parse the comma/space/newline-separated alert recipient list. */
export function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    ),
  );
}
