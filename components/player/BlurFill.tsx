'use client';

import { useEffect, useRef } from 'react';

/**
 * A blurred, darkened copy of a playing <video>, drawn from its frames onto
 * a tiny canvas (~10 fps, one decoder shared with the real video) and
 * scaled to fill the screen. Sits behind a letterboxed video so a 16:9 loop
 * on a 9:16 screen fills the frame instead of floating in a band.
 */
export function BlurFill({ video, active = true }: { video: HTMLVideoElement | null; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !video || !active) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match the bitmap's aspect to the box so the fill is not stretched,
    // and again whenever the box changes shape (a live orientation flip
    // turns the design canvas from 9:16 to 16:9 under us).
    const size = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const w = Math.max(16, Math.round((96 * rect.width) / rect.height));
      if (canvas.width !== w || canvas.height !== 96) {
        canvas.height = 96;
        canvas.width = w;
      }
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(canvas);

    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return;
      last = t;
      if (video.readyState < 2) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const s = Math.max(cw / vw, ch / vh);
      const dw = vw * s;
      const dh = vh * s;
      ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [video, active]);

  return (
    <canvas
      ref={ref}
      width={54}
      height={96}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        filter: 'blur(18px) brightness(0.5) saturate(1.2)',
        transform: 'scale(1.2)',
        opacity: active ? 1 : 0,
        transition: 'opacity 600ms ease-out',
      }}
    />
  );
}
