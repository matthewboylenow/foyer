'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionValue, useTransform, animate } from 'motion/react';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface NumberCountProps {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  formatter?: (n: number) => string;
  className?: string;
}

export function NumberCount({
  from = 0,
  to,
  duration = 1500,
  delay = 0,
  formatter = (n) => Math.round(n).toLocaleString(),
  className,
}: NumberCountProps) {
  const motionValue = useMotionValue(from);
  const [display, setDisplay] = useState(formatter(from));
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const unsub = motionValue.on('change', (v) => setDisplay(formatter(v)));

    const timer = setTimeout(() => {
      animate(motionValue, to, {
        duration: duration / 1000,
        ease: EASING,
      });
    }, delay);

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [motionValue, to, duration, delay, formatter]);

  // useTransform keeps the ref stable
  void useTransform(motionValue, (v) => formatter(v));

  return <span className={className}>{display}</span>;
}
