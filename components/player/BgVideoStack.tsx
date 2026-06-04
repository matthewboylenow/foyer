'use client';

import { useEffect, useRef } from 'react';

interface BgVideoStackProps {
  urls: string[];
  activeUrl: string | null;
}

/**
 * Renders every unique bg-video URL in the slide pool as a stable, persistent
 * <video> element behind the slide layer. Only the active URL is opaque + playing;
 * the others are paused and hidden. Because the elements never unmount, Tizen /
 * Chromium can keep the bytes resident — the prior approach remounted the
 * <video> on every slide rotation, which forced fresh Range requests to Blob
 * each cycle and dominated transfer usage.
 */
export function BgVideoStack({ urls, activeUrl }: BgVideoStackProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {urls.map((url) => (
        <BgVideoEl key={url} url={url} active={url === activeUrl} />
      ))}
    </div>
  );
}

function BgVideoEl({ url, active }: { url: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      void el.play().catch(() => {
        /* autoplay may be denied on first user-less load; the next cycle
           will retry once the element has been seen. */
      });
    } else {
      el.pause();
    }
  }, [active]);

  return (
    <video
      ref={ref}
      src={url}
      muted
      loop
      playsInline
      preload="auto"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: active ? 1 : 0,
        transition: 'opacity 600ms ease-out',
      }}
    />
  );
}
