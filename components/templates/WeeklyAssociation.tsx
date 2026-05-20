'use client';

import { motion } from 'motion/react';
import type { WeeklyAssociationContent } from '@/lib/db/schema';

interface WeeklyAssociationProps {
  content: WeeklyAssociationContent;
}

export function WeeklyAssociation({ content }: WeeklyAssociationProps) {
  const { names } = content;
  const twoColumns = names.length > 6;
  // Auto-scale: if more than 9 names, drop from 64px toward 48px
  const fontSize = names.length > 9 ? Math.max(48, 64 - (names.length - 9) * 4) : 64;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Soft warm gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 80%, rgba(205,83,52,0.05) 0%, transparent 70%)',
        }}
      />
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      <div
        className="relative z-10 flex flex-col items-center h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-sans text-rust uppercase tracking-widest" style={{ fontSize: 22 }}>
            This Week We Pray For
          </p>
          <h2 className="font-serif text-navy mt-2" style={{ fontSize: 64 }}>
            Our Weekly Mass Association
          </h2>
        </motion.div>

        {/* Separator */}
        <motion.div
          className="w-24 h-px bg-gold mb-10"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        />

        {/* Names */}
        <div
          className={`${twoColumns ? 'grid grid-cols-2 gap-x-16' : 'flex flex-col'} gap-y-4 w-full`}
        >
          {names.map((name, i) => (
            <motion.p
              key={i}
              className="font-serif text-navy text-center leading-tight"
              style={{ fontSize }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.2 }}
            >
              {name}
            </motion.p>
          ))}
        </div>
      </div>
    </div>
  );
}
