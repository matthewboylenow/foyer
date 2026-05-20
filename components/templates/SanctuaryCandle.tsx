'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { GlowPulse } from '@/components/motion/GlowPulse';
import { KenBurns } from '@/components/motion/KenBurns';
import { SANCTUARY_CANDLE_NAME_SIZE, resolveSize } from './sizing';
import type { SanctuaryCandleContent } from '@/lib/db/schema';

// Subtle "ember" particles drifting up — adds prayer-light atmosphere
const EMBERS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: 30 + Math.random() * 40,
  delay: i * 0.8,
  duration: 6 + Math.random() * 4,
  size: 2 + Math.random() * 2,
}));

interface SanctuaryCandleProps {
  content: SanctuaryCandleContent;
  bgImageUrl?: string;
}

export function SanctuaryCandle({ content, bgImageUrl }: SanctuaryCandleProps) {
  const { name, inMemoryOf = true, nameSize } = content;
  const captionLine = inMemoryOf ? 'In Memory Of' : 'In Honor Of';
  const namePx = resolveSize(SANCTUARY_CANDLE_NAME_SIZE, nameSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-ink">
      {/* Optional bg image with a heavy dark wash — candle SVG needs near-black behind it. */}
      {bgImageUrl && (
        <>
          <KenBurns src={bgImageUrl} duration={32000} />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,13,18,0.78) 0%, rgba(11,13,18,0.62) 45%, rgba(11,13,18,0.85) 100%)',
            }}
          />
        </>
      )}

      {/* Layered glows for depth */}
      <GlowPulse
        color="rgba(212,175,55,0.16)"
        size={500}
        y="38%"
        duration={4500}
      />
      <GlowPulse
        color="rgba(205,83,52,0.06)"
        size={800}
        y="45%"
        duration={8000}
      />

      {/* Drifting embers */}
      <div className="absolute inset-0 pointer-events-none">
        {EMBERS.map((e) => (
          <motion.span
            key={e.id}
            className="absolute rounded-full bg-gold"
            style={{
              left: `${e.left}%`,
              bottom: '38%',
              width: e.size,
              height: e.size,
              boxShadow: '0 0 6px rgba(212,175,55,0.6)',
            }}
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: [0, 0.7, 0],
              y: [0, -260, -340],
              x: [0, (e.id % 2 === 0 ? 1 : -1) * 30],
            }}
            transition={{
              duration: e.duration,
              delay: e.delay,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(11,13,18,0.7) 100%)',
        }}
      />

      <FilmGrain opacity={0.07} />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        {/* Candle */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg
            width="80"
            height="240"
            viewBox="0 0 80 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Halo glow around flame */}
            <motion.ellipse
              cx="40"
              cy="50"
              rx="30"
              ry="40"
              fill="url(#flameGlow)"
              animate={{ rx: [28, 32, 26, 28], ry: [40, 44, 38, 40], opacity: [0.7, 1, 0.6, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Candle body */}
            <rect x="24" y="80" width="32" height="152" rx="4" fill="#FAF9F7" opacity="0.92" />
            <rect x="24" y="80" width="4" height="152" rx="2" fill="#fff" opacity="0.18" />
            <rect x="50" y="80" width="3" height="152" rx="1.5" fill="#000" opacity="0.18" />
            {/* Wax drip */}
            <path d="M24 100 Q20 110 22 120 Q24 115 24 110 Z" fill="#FAF9F7" opacity="0.6" />
            {/* Wick */}
            <line x1="40" y1="80" x2="40" y2="68" stroke="#444" strokeWidth="1.5" />
            {/* Flame */}
            <motion.path
              d="M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z"
              fill="#D4AF37"
              animate={{
                d: [
                  'M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z',
                  'M40 68 C36 62 31 50 41 30 C50 46 47 62 40 68 Z',
                  'M40 68 C33 58 31 46 40 34 C49 50 45 58 40 68 Z',
                  'M40 68 C35 61 30 49 40 31 C51 47 46 61 40 68 Z',
                  'M40 68 C34 60 30 48 40 32 C50 48 46 60 40 68 Z',
                ],
                opacity: [0.95, 1, 0.88, 0.95, 0.95],
              }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Inner bright flame */}
            <motion.ellipse
              cx="40"
              cy="52"
              rx="6"
              ry="10"
              fill="#FFF3C4"
              animate={{ ry: [10, 12, 9, 10], opacity: [0.7, 0.95, 0.5, 0.7] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>

        {/* Caption */}
        <BlurIn delay={1200} duration={1100} y={8} blur={6} className="mb-6">
          <p
            className="font-sans text-gold uppercase tracking-widest"
            style={{ fontSize: 22, opacity: 0.9 }}
          >
            Our Sanctuary Candle Burns This Week
          </p>
          <p
            className="font-sans text-gold uppercase tracking-widest mt-2"
            style={{ fontSize: 22, opacity: 0.7 }}
          >
            {captionLine}
          </p>
        </BlurIn>

        {/* Name */}
        <div
          className="font-serif text-cream leading-tight"
          style={{
            fontSize: namePx,
            textShadow: '0 4px 32px rgba(212,175,55,0.18)',
            letterSpacing: '-0.005em',
          }}
        >
          <WordStagger text={name} delay={2000} staggerMs={140} />
        </div>
      </div>
    </div>
  );
}
