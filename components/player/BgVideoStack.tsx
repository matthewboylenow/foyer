'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BlurFill } from './BlurFill';

interface BgVideoStackProps {
  urls: string[];
  activeUrl: string | null;
  /** How the active video sits in the frame; from the slide's content. */
  fit?: 'cover' | 'contain';
}

/**
 * Renders every unique bg-video URL in the slide pool as a stable, persistent
 * <video> element behind the slide layer. Only the active URL is opaque + playing;
 * the others are paused and hidden. Because the elements never unmount, Tizen /
 * Chromium can keep the bytes resident — the prior approach remounted the
 * <video> on every slide rotation, which forced fresh Range requests
 * each cycle and dominated transfer usage.
 *
 * With fit "contain" the whole video shows, and a blurred copy of its own
 * frames fills the rest of the screen (see BlurFill) so nothing reads as
 * a small band in the middle.
 */
export function BgVideoStack({ urls, activeUrl, fit = 'cover' }: BgVideoStackProps) {
  const [els, setEls] = useState<Record<string, HTMLVideoElement | null>>({});
  const register = useCallback((url: string, el: HTMLVideoElement | null) => {
    setEls((prev) => (prev[url] === el ? prev : { ...prev, [url]: el }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {fit === 'contain' && activeUrl && <BlurFill video={els[activeUrl] ?? null} />}
      {urls.map((url) => (
        <BgVideoEl key={url} url={url} active={url === activeUrl} fit={fit} onElement={register} />
      ))}
    </div>
  );
}

function BgVideoEl({
  url,
  active,
  fit,
  onElement,
}: {
  url: string;
  active: boolean;
  fit: 'cover' | 'contain';
  onElement: (url: string, el: HTMLVideoElement | null) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  // Hand the element up once per mount. (An inline callback ref here
  // re-ran on every render, detaching and reattaching, and each pass set
  // state in the parent: an infinite update loop, React error #185.)
  useEffect(() => {
    onElement(url, ref.current);
    return () => onElement(url, null);
  }, [url, onElement]);

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
        objectFit: fit,
        opacity: active ? 1 : 0,
        transition: 'opacity 600ms ease-out',
      }}
    />
  );
}
