'use client';

import { motion } from 'motion/react';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { palette } from './style';
import { BgLayer } from './BgLayer';
import type { WeeklyAssociationContent } from '@/lib/db/schema';

interface WeeklyAssociationProps {
  content: WeeklyAssociationContent;
  bgImageUrl?: string;
}

export function WeeklyAssociation({ content, bgImageUrl }: WeeklyAssociationProps) {
  const { names, textMode } = content;
  const p = palette(textMode ?? 'dark');
  const fontSize = names.length > 7 ? Math.max(32, 44 - (names.length - 7) * 2) : 44;

  return (
    <div className={`relative w-full h-full overflow-hidden ${p.pageBg}`}>
      <BgLayer bgImageUrl={bgImageUrl} tint={p.bgImageTint} ambient={p.ambient} />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col items-center h-full"
        style={{ padding: '120px 80px' }}
      >
        <BlurIn delay={0} duration={1100} y={8}>
          <div className="text-center mb-6">
            <p
              className={`font-sans uppercase tracking-widest ${p.accent}`}
              style={{ fontSize: 22 }}
            >
              This Week We Pray For
            </p>
            <h2
              className={`font-serif mt-3 leading-tight ${p.primary}`}
              style={{ fontSize: 64, letterSpacing: '-0.01em' }}
            >
              Our Weekly Mass Association
            </h2>
          </div>
        </BlurIn>

        <motion.div
          className={`w-24 h-px mb-12 ${p.rule}`}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.7 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        <div className="flex flex-col items-center gap-y-5 w-full">
          {names.map((name, i) => (
            <BlurIn key={i} delay={1100 + i * 220} duration={900} y={10}>
              <p
                className={`font-serif text-center leading-tight ${p.primary}`}
                style={{ fontSize, letterSpacing: '-0.005em' }}
              >
                {name}
              </p>
            </BlurIn>
          ))}
        </div>
      </div>
    </div>
  );
}
