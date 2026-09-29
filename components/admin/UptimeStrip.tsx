'use client';

import type { Bucket } from '@/lib/monitoring';

interface UptimeStripProps {
  buckets: Bucket[];
  /** Label for the left edge, e.g. "7 days ago". */
  fromLabel?: string;
}

const COLORS: Record<Bucket['state'], string> = {
  up: 'bg-emerald-500',
  partial: 'bg-amber-400',
  down: 'bg-rust',
  unknown: 'bg-navy/10',
};

function bucketTitle(b: Bucket): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  const label =
    b.state === 'up'
      ? 'Up'
      : b.state === 'down'
        ? 'Down'
        : b.state === 'partial'
          ? 'Partly down'
          : 'No data';
  return `${label} · ${fmt(b.start)} – ${fmt(b.end)}`;
}

/** One bar per bucket, oldest on the left — the UptimeKuma heartbeat bar. */
export function UptimeStrip({ buckets, fromLabel = '7 days ago' }: UptimeStripProps) {
  return (
    <div>
      <div className="flex items-end gap-px h-6" role="img" aria-label="Uptime history">
        {buckets.map((b) => (
          <span
            key={b.start}
            title={bucketTitle(b)}
            className={`flex-1 min-w-[2px] rounded-[1px] ${COLORS[b.state]} ${
              b.state === 'unknown' ? 'h-3' : 'h-full'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-navy/40 mt-1">
        <span>{fromLabel}</span>
        <span>now</span>
      </div>
    </div>
  );
}
