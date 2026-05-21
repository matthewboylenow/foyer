'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface TimeAgoProps {
  date: string | Date;
  className?: string;
}

/**
 * Renders a relative time string ("2 minutes ago"). Server renders nothing
 * to avoid hydration mismatch (server time != client time), and the value
 * appears after mount. Tooltip on the wrapped span shows the absolute ISO
 * string for power users.
 */
export function TimeAgo({ date, className }: TimeAgoProps) {
  const iso = typeof date === 'string' ? date : date.toISOString();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatDistanceToNow(new Date(iso), { addSuffix: true }));
    update();
    // Refresh once a minute so "just now" doesn't get stuck.
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [iso]);

  return (
    <span className={className} title={iso} suppressHydrationWarning>
      {label ?? ''}
    </span>
  );
}
