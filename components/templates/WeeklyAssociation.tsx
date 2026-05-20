'use client';

import { motion } from 'motion/react';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import type { WeeklyAssociationContent } from '@/lib/db/schema';

export function WeeklyAssociation({ content }: { content: WeeklyAssociationContent }) {
  const { names } = content;
  // Baseline 44px (down from 64) so names read in line with the rest of the
  // templates rather than dominating the canvas. Auto-scale down for long lists.
  const fontSize = names.length > 7 ? Math.max(32, 44 - (names.length - 7) * 2) : 44;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Warm static accent. Was animating the `background` property which
          forced a full-frame repaint each tick — punishing on signage GPUs. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 72%, rgba(205,83,52,0.07) 0%, transparent 62%)',
        }}
      />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col items-center h-full"
        style={{ padding: '120px 80px' }}
      >
        <BlurIn delay={0} duration={1100} y={8} blur={6}>
          <div className="text-center mb-6">
            <p
              className="font-sans text-rust uppercase tracking-widest"
              style={{ fontSize: 22 }}
            >
              This Week We Pray For
            </p>
            <h2
              className="font-serif text-navy mt-3 leading-tight"
              style={{ fontSize: 64, letterSpacing: '-0.01em' }}
            >
              Our Weekly Mass Association
            </h2>
          </div>
        </BlurIn>

        <motion.div
          className="w-24 h-px bg-gold mb-12"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.7 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        <div className="flex flex-col items-center gap-y-5 w-full">
          {names.map((name, i) => (
            <BlurIn
              key={i}
              delay={1100 + i * 220}
              duration={900}
              y={10}
              blur={5}
            >
              <p
                className="font-serif text-navy text-center leading-tight"
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
