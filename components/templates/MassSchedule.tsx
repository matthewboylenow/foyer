'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import type { MassScheduleContent } from '@/lib/db/schema';

interface MassScheduleProps {
  content: MassScheduleContent;
}

export function MassSchedule({ content }: MassScheduleProps) {
  const { scheduleKind, rows } = content;
  const title = scheduleKind === 'weekend' ? "This Weekend's Masses" : 'Weekday Masses';

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Header */}
        <h2 className="font-serif text-navy mb-12" style={{ fontSize: 64 }}>
          <LineMask text={title} delay={0} duration={700} />
        </h2>

        {/* Rows */}
        <div className="flex flex-col gap-8 flex-1">
          {rows.map((row, i) => (
            <motion.div
              key={i}
              className="flex gap-8 items-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.15 }}
            >
              {/* Time label */}
              <span
                className="font-serif text-rust shrink-0"
                style={{ fontSize: 64, lineHeight: 1.1, minWidth: 200 }}
              >
                {row.timeLabel}
              </span>

              {/* Divider */}
              <div className="w-px bg-navy-100 self-stretch mx-2" />

              {/* Intention */}
              <span
                className="font-sans text-navy leading-snug"
                style={{ fontSize: 36 }}
              >
                {row.intention}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
