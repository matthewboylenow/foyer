'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import type { MassScheduleContent } from '@/lib/db/schema';

export function MassSchedule({ content }: { content: MassScheduleContent }) {
  const { scheduleKind, rows } = content;
  const title = scheduleKind === 'weekend' ? "This Weekend's Masses" : 'Weekday Masses';

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Warm ambient glow low-left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 10% 90%, rgba(205,83,52,0.06) 0%, transparent 55%)',
        }}
      />
      {/* Gold accent high-right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 95% 5%, rgba(212,175,55,0.05) 0%, transparent 50%)',
        }}
      />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        <h2
          className="font-serif text-navy mb-4 leading-tight"
          style={{ fontSize: 64, letterSpacing: '-0.01em' }}
        >
          <LineMask text={title} delay={0} duration={900} />
        </h2>

        {/* Gold rule */}
        <motion.div
          className="h-px bg-gold mb-10"
          style={{ originX: 0 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-32" />
        </motion.div>

        <div className="flex flex-col gap-8 flex-1">
          {rows.map((row, i) => (
            <BlurIn
              key={i}
              delay={1100 + i * 180}
              duration={900}
              y={8}
              blur={6}
            >
              <div className="flex gap-8 items-start">
                <span
                  className="font-serif text-rust shrink-0"
                  style={{ fontSize: 64, lineHeight: 1.1, minWidth: 240, letterSpacing: '-0.01em' }}
                >
                  {row.timeLabel}
                </span>
                <div className="w-px bg-navy-100 self-stretch" />
                <span
                  className="font-sans text-navy leading-snug"
                  style={{ fontSize: 36 }}
                >
                  {row.intention}
                </span>
              </div>
            </BlurIn>
          ))}
        </div>
      </div>
    </div>
  );
}
