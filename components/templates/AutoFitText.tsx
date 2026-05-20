'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

interface AutoFitTextProps {
  /** HTML string from TipTap, or plain text */
  html: string;
  /** Starting font size (max). Will shrink from here if content overflows. */
  maxSize: number;
  /** Floor font size — won't shrink past this even if content still overflows. */
  minSize?: number;
  /** Decrement step in px (default 2 — fine-grained for natural scaling) */
  step?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Measures the rendered content against its parent and shrinks the font
 * size until everything fits (or hits minSize). The parent must have a
 * bounded height — typically achieved by flex-1 + min-h-0 + overflow-hidden
 * on the wrapper. Re-measures on container resize and when html changes.
 */
export function AutoFitText({
  html,
  maxSize,
  minSize,
  step = 2,
  className,
  style,
}: AutoFitTextProps) {
  const floor = minSize ?? Math.max(20, Math.floor(maxSize * 0.5));
  const ref = useRef<HTMLDivElement>(null);

  const fit = () => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    let size = maxSize;
    el.style.fontSize = `${size}px`;

    const maxIter = Math.ceil((maxSize - floor) / step) + 2;
    let iter = 0;

    while (
      size > floor &&
      (el.scrollHeight > parent.clientHeight || el.scrollWidth > parent.clientWidth) &&
      iter < maxIter
    ) {
      size -= step;
      el.style.fontSize = `${size}px`;
      iter += 1;
    }
  };

  // Run after every render — content may have changed
  useLayoutEffect(fit);

  // Re-fit if the container itself resizes (e.g. live preview scale changes)
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, fontSize: maxSize }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
