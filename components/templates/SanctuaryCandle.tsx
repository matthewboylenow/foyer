'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import type { SanctuaryCandleContent } from '@/lib/db/schema';

interface SanctuaryCandleProps {
  content: SanctuaryCandleContent;
}

export function SanctuaryCandle({ content }: SanctuaryCandleProps) {
  const { name, inMemoryOf = true } = content;
  const captionLine = inMemoryOf ? 'In Memory Of' : 'In Honor Of';

  return (
    <div className="relative w-full h-full overflow-hidden bg-ink">
      {/* Warm radial glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 600px 800px at 50% 38%, rgba(212,175,55,0.08) 0%, transparent 70%)',
        }}
        animate={{ opacity: [1, 0.92, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(11,13,18,0.6) 100%)',
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        {/* SVG Candle */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <svg
            width="80"
            height="240"
            viewBox="0 0 80 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Candle body */}
            <rect x="24" y="80" width="32" height="152" rx="4" fill="#FAF9F7" opacity="0.9" />
            {/* Wax drip */}
            <path
              d="M24 100 Q20 110 22 120 Q24 115 24 110 Z"
              fill="#FAF9F7"
              opacity="0.6"
            />
            {/* Wick */}
            <line x1="40" y1="80" x2="40" y2="68" stroke="#888" strokeWidth="1.5" />
            {/* Flame */}
            <motion.path
              d="M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z"
              fill="#D4AF37"
              animate={{
                d: [
                  'M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z',
                  'M40 68 C36 62 31 50 41 30 C50 46 47 62 40 68 Z',
                  'M40 68 C33 58 31 46 40 34 C49 50 45 58 40 68 Z',
                  'M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z',
                ],
                opacity: [0.9, 1, 0.85, 0.9],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Flame inner glow */}
            <motion.ellipse
              cx="40"
              cy="52"
              rx="6"
              ry="10"
              fill="#FAF9F7"
              opacity="0.5"
              animate={{ ry: [10, 11, 9, 10], opacity: [0.5, 0.6, 0.4, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>

        {/* Caption */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <p className="font-sans text-gold uppercase tracking-widest" style={{ fontSize: 22 }}>
            Our Sanctuary Candle Burns This Week
          </p>
          <p className="font-sans text-gold uppercase tracking-widest mt-2" style={{ fontSize: 22 }}>
            {captionLine}
          </p>
        </motion.div>

        {/* Name */}
        <div className="font-serif text-cream leading-tight" style={{ fontSize: 140 }}>
          <WordStagger text={name} delay={1800} staggerMs={120} />
        </div>
      </div>
    </div>
  );
}
