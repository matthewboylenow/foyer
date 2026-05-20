'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { palette } from './style';
import { BgLayer } from './BgLayer';
import type { MassScheduleContent, MassScheduleRow, TextMode } from '@/lib/db/schema';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
  timeClass: string;
  intentionClass: string;
}

function MassRow({ row, delay, timeSize, intentionSize, timeClass, intentionClass }: MassRowProps) {
  const t = { duration: 0.8, delay: delay / 1000, ease: EASING };
  const enter = { opacity: 0, y: 6 } as const;
  const settled = { opacity: 1, y: 0 } as const;

  return (
    <>
      <motion.span
        className={`font-serif text-left ${timeClass}`}
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
        className={`font-sans text-left leading-snug ${intentionClass}`}
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

function SectionTitle({ text, delay, accentClass }: { text: string; delay: number; accentClass: string }) {
  return (
    <motion.p
      className={`col-span-2 font-sans uppercase tracking-widest text-left ${accentClass}`}
      style={{ fontSize: 22 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: delay / 1000, ease: EASING }}
    >
      {text}
    </motion.p>
  );
}

interface MassScheduleProps {
  content: MassScheduleContent;
  bgImageUrl?: string;
}

export function MassSchedule({ content, bgImageUrl }: MassScheduleProps) {
  const { weekendLabel, weekendRows, weekdayRows } = normalize(content);
  const totalRows = weekendRows.length + weekdayRows.length;
  const hasBoth = weekendRows.length > 0 && weekdayRows.length > 0;
  const mode: TextMode = content.textMode ?? 'dark';
  const p = palette(mode);

  const tight = totalRows > 10;
  const medium = totalRows > 6 && totalRows <= 10;
  const timeSize = tight ? 40 : medium ? 44 : 48;
  const intentionSize = tight ? 28 : medium ? 30 : 32;

  const titleDelay = 1100;
  const rowGap = 130;
  const sectionGap = 400;

  return (
    <div className={`relative w-full h-full overflow-hidden ${p.pageBg}`}>
      <BgLayer
        bgImageUrl={bgImageUrl}
        tint={p.bgImageTint}
        ambient={
          mode === 'light'
            ? p.ambient
            : 'radial-gradient(ellipse at 10% 90%, rgba(205,83,52,0.07) 0%, transparent 55%)'
        }
      />

      {/* Secondary warm corner accent (only without a bg image, to preserve depth) */}
      {!bgImageUrl && mode === 'dark' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 95% 5%, rgba(212,175,55,0.06) 0%, transparent 50%)',
          }}
        />
      )}

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        <h2
          className={`font-serif mb-3 leading-[1.05] ${p.primary}`}
          style={{ fontSize: 80, letterSpacing: '-0.015em' }}
        >
          <LineMask text="Mass Intentions" delay={0} duration={1000} />
        </h2>

        <motion.div
          className={`h-px mb-10 ${p.rule}`}
          style={{ originX: 0 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, delay: 0.7, ease: EASING }}
        >
          <div className="w-40" />
        </motion.div>

        <div
          className="grid gap-x-10 gap-y-5 flex-1 min-h-0"
          style={{ gridTemplateColumns: 'max-content 1fr' }}
        >
          {weekendRows.length > 0 && (
            <>
              <SectionTitle
                text={weekendLabel?.trim() ? weekendLabel : "This Weekend's Masses"}
                delay={titleDelay}
                accentClass={p.accent}
              />
              {weekendRows.map((row, i) => (
                <MassRow
                  key={`w-${i}`}
                  row={row}
                  delay={titleDelay + 250 + i * rowGap}
                  timeSize={timeSize}
                  intentionSize={intentionSize}
                  timeClass={p.accent}
                  intentionClass={p.primary}
                />
              ))}
            </>
          )}

          {hasBoth && (
            <motion.div
              className={`col-span-2 h-px my-2 ${
                mode === 'light' ? 'bg-cream/30' : 'bg-navy-100'
              }`}
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
                accentClass={p.accent}
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
                    timeClass={p.accent}
                    intentionClass={p.primary}
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
