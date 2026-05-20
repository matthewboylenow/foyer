'use client';

import { motion } from 'motion/react';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import type { WeeklyAssociationContent } from '@/lib/db/schema';

export function WeeklyAssociation({ content }: { content: WeeklyAssociationContent }) {
  const { names } = content;
  const twoColumns = names.length > 6;
  const fontSize = names.length > 9 ? Math.max(48, 64 - (names.length - 9) * 4) : 64;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Warm breathing background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 50% 70%, rgba(205,83,52,0.06) 0%, transparent 60%)',
            'radial-gradient(ellipse at 50% 75%, rgba(205,83,52,0.08) 0%, transparent 65%)',
            'radial-gradient(ellipse at 50% 70%, rgba(205,83,52,0.06) 0%, transparent 60%)',
          ],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
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

        <div
          className={`${twoColumns ? 'grid grid-cols-2 gap-x-20' : 'flex flex-col'} gap-y-5 w-full`}
        >
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
