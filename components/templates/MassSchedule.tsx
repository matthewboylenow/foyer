'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import type { MassScheduleContent, MassScheduleRow } from '@/lib/db/schema';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Normalize legacy single-section data into the new dual-section shape.
 * Existing slides saved with { scheduleKind: 'weekend', rows: [...] }
 * still render correctly under the combined layout.
 */
function normalize(content: MassScheduleContent) {
  if (content.weekendRows || content.weekdayRows) {
    return {
      weekendLabel: content.weekendLabel,
      weekendRows: content.weekendRows ?? [],
      weekdayRows: content.weekdayRows ?? [],
    };
  }
  // Legacy fallback
  if (content.scheduleKind === 'weekend') {
    return { weekendLabel: undefined, weekendRows: content.rows ?? [], weekdayRows: [] };
  }
  if (content.scheduleKind === 'weekday') {
    return { weekendLabel: undefined, weekendRows: [], weekdayRows: content.rows ?? [] };
  }
  return { weekendLabel: undefined, weekendRows: [], weekdayRows: [] };
}

interface SectionProps {
  title: string;
  rows: MassScheduleRow[];
  /** Time-to-first-row delay in ms */
  baseDelay: number;
}

function Section({ title, rows, baseDelay }: SectionProps) {
  if (rows.length === 0) return null;
  // Auto-scale row text down a notch when there are many rows in this section
  const big = rows.length <= 5;
  const timeSize = big ? 48 : 40;
  const intentionSize = big ? 32 : 28;
  const rowGap = big ? 'gap-y-5' : 'gap-y-4';

  return (
    <div className={`flex flex-col ${rowGap}`}>
      <BlurIn delay={baseDelay} duration={900} y={6} blur={5}>
        <p
          className="font-sans text-rust uppercase tracking-widest"
          style={{ fontSize: 22 }}
        >
          {title}
        </p>
      </BlurIn>
      {rows.map((row, i) => (
        <BlurIn
          key={i}
          delay={baseDelay + 250 + i * 130}
          duration={800}
          y={6}
          blur={5}
        >
          <div className="flex gap-6 items-baseline">
            <span
              className="font-serif text-rust shrink-0"
              style={{
                fontSize: timeSize,
                lineHeight: 1.05,
                minWidth: 200,
                letterSpacing: '-0.01em',
              }}
            >
              {row.timeLabel}
            </span>
            <span
              className="font-sans text-navy leading-snug"
              style={{ fontSize: intentionSize }}
            >
              {row.intention}
            </span>
          </div>
        </BlurIn>
      ))}
    </div>
  );
}

export function MassSchedule({ content }: { content: MassScheduleContent }) {
  const { weekendLabel, weekendRows, weekdayRows } = normalize(content);

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Warm low-left ambient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 10% 90%, rgba(205,83,52,0.07) 0%, transparent 55%)',
        }}
      />
      {/* Gold high-right accent */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 95% 5%, rgba(212,175,55,0.06) 0%, transparent 50%)',
        }}
      />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Master title */}
        <h2
          className="font-serif text-navy mb-3 leading-[1.05]"
          style={{ fontSize: 80, letterSpacing: '-0.015em' }}
        >
          <LineMask text="Mass Intentions" delay={0} duration={1000} />
        </h2>

        {/* Gold rule */}
        <motion.div
          className="h-px bg-gold mb-10"
          style={{ originX: 0 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, delay: 0.7, ease: EASING }}
        >
          <div className="w-40" />
        </motion.div>

        {/* Two stacked sections */}
        <div className="flex flex-col gap-10 flex-1 min-h-0">
          <Section
            title={weekendLabel?.trim() ? weekendLabel : "This Weekend's Masses"}
            rows={weekendRows}
            baseDelay={1100}
          />
          {weekendRows.length > 0 && weekdayRows.length > 0 && (
            <div className="h-px bg-navy-100" />
          )}
          <Section
            title="Daily Mass Intentions"
            rows={weekdayRows}
            baseDelay={1100 + weekendRows.length * 130 + (weekendRows.length > 0 ? 400 : 0)}
          />
        </div>
      </div>
    </div>
  );
}
