'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { FilmGrain } from '@/components/motion/FilmGrain';
import type { MassScheduleContent, MassScheduleRow } from '@/lib/db/schema';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Normalize legacy single-section data into the new dual-section shape.
 */
function normalize(content: MassScheduleContent) {
  if (content.weekendRows || content.weekdayRows) {
    return {
      weekendLabel: content.weekendLabel,
      weekendRows: content.weekendRows ?? [],
      weekdayRows: content.weekdayRows ?? [],
    };
  }
  if (content.scheduleKind === 'weekend') {
    return { weekendLabel: undefined, weekendRows: content.rows ?? [], weekdayRows: [] };
  }
  if (content.scheduleKind === 'weekday') {
    return { weekendLabel: undefined, weekendRows: [], weekdayRows: content.rows ?? [] };
  }
  return { weekendLabel: undefined, weekendRows: [], weekdayRows: [] };
}

interface MassRowProps {
  row: MassScheduleRow;
  delay: number;
  timeSize: number;
  intentionSize: number;
}

function MassRow({ row, delay, timeSize, intentionSize }: MassRowProps) {
  const t = { duration: 0.8, delay: delay / 1000, ease: EASING };
  const enter = { opacity: 0, y: 6 } as const;
  const settled = { opacity: 1, y: 0 } as const;

  return (
    <>
      <motion.span
        className="font-serif text-rust text-left"
        style={{
          fontSize: timeSize,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
        initial={enter}
        animate={settled}
        transition={t}
      >
        {row.timeLabel}
      </motion.span>
      <motion.span
        className="font-sans text-navy text-left leading-snug"
        style={{ fontSize: intentionSize }}
        initial={enter}
        animate={settled}
        transition={t}
      >
        {row.intention}
      </motion.span>
    </>
  );
}

interface SectionTitleProps {
  text: string;
  delay: number;
}

function SectionTitle({ text, delay }: SectionTitleProps) {
  return (
    <motion.p
      className="col-span-2 font-sans text-rust uppercase tracking-widest text-left"
      style={{ fontSize: 22 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: delay / 1000, ease: EASING }}
    >
      {text}
    </motion.p>
  );
}

export function MassSchedule({ content }: { content: MassScheduleContent }) {
  const { weekendLabel, weekendRows, weekdayRows } = normalize(content);
  const totalRows = weekendRows.length + weekdayRows.length;
  const hasBoth = weekendRows.length > 0 && weekdayRows.length > 0;

  // Uniform typography across both sections, sized by total row count
  const tight = totalRows > 10;
  const medium = totalRows > 6 && totalRows <= 10;
  const timeSize = tight ? 40 : medium ? 44 : 48;
  const intentionSize = tight ? 28 : medium ? 30 : 32;

  // Base delays for stagger
  const titleDelay = 1100;
  const rowGap = 130;
  const sectionGap = 400;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Ambient warm glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 10% 90%, rgba(205,83,52,0.07) 0%, transparent 55%)',
        }}
      />
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
        <h2
          className="font-serif text-navy mb-3 leading-[1.05]"
          style={{ fontSize: 80, letterSpacing: '-0.015em' }}
        >
          <LineMask text="Mass Intentions" delay={0} duration={1000} />
        </h2>

        <motion.div
          className="h-px bg-gold mb-10"
          style={{ originX: 0 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, delay: 0.7, ease: EASING }}
        >
          <div className="w-40" />
        </motion.div>

        {/* Single grid spans BOTH sections — time column auto-sizes to widest
            entry across all rows, so weekend times and daily dates share the
            same left edge. */}
        <div
          className="grid gap-x-10 gap-y-5 flex-1 min-h-0"
          style={{ gridTemplateColumns: 'max-content 1fr' }}
        >
          {weekendRows.length > 0 && (
            <>
              <SectionTitle
                text={weekendLabel?.trim() ? weekendLabel : "This Weekend's Masses"}
                delay={titleDelay}
              />
              {weekendRows.map((row, i) => (
                <MassRow
                  key={`w-${i}`}
                  row={row}
                  delay={titleDelay + 250 + i * rowGap}
                  timeSize={timeSize}
                  intentionSize={intentionSize}
                />
              ))}
            </>
          )}

          {hasBoth && (
            <motion.div
              className="col-span-2 h-px bg-navy-100 my-2"
              style={{ originX: 0 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.7 }}
              transition={{
                duration: 0.9,
                delay: (titleDelay + 250 + weekendRows.length * rowGap + 100) / 1000,
                ease: EASING,
              }}
            />
          )}

          {weekdayRows.length > 0 && (
            <>
              <SectionTitle
                text="Daily Mass Intentions"
                delay={
                  titleDelay +
                  (weekendRows.length > 0
                    ? 250 + weekendRows.length * rowGap + sectionGap
                    : 0)
                }
              />
              {weekdayRows.map((row, i) => {
                const base =
                  titleDelay +
                  (weekendRows.length > 0
                    ? 250 + weekendRows.length * rowGap + sectionGap + 250
                    : 250);
                return (
                  <MassRow
                    key={`d-${i}`}
                    row={row}
                    delay={base + i * rowGap}
                    timeSize={timeSize}
                    intentionSize={intentionSize}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
