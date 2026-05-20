'use client';

interface WordStaggerProps {
  text: string;
  delay?: number;
  staggerMs?: number;
  className?: string;
}

// Pure CSS stagger — was previously one framer-motion instance per word,
// which meant 10+ JS-driven rAF loops on every text headline. The CSS
// keyframe is defined in globals.css (`@keyframes word-stagger-rise`).
export function WordStagger({ text, delay = 0, staggerMs = 80, className }: WordStaggerProps) {
  const words = text.split(' ').filter(Boolean);

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          className="word-stagger inline-block"
          style={{ animationDelay: `${delay + i * staggerMs}ms` }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
