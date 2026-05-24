/**
 * Per-tenant slide font pairs.
 *
 * Each pair defines a serif (for `font-serif` / headlines) and a sans
 * (for `font-sans` / body) that the slide templates consume via the
 * --font-serif and --font-sans CSS variables. The TenantTheme component
 * injects a Google Fonts <link> for the chosen pair and overrides those
 * variables so the whole slide-rendering subtree picks up the choice.
 *
 * Adding a new pair: append here, no schema migration required (the
 * column is text, not an enum). Unknown ids fall back to DEFAULT_PAIR.
 */

export interface FontPair {
  /** Stable id stored in settings.font_pair. Kebab-case. */
  id: string;
  /** Short display label shown in the picker. */
  label: string;
  /** One-line description shown next to the label. */
  description: string;
  /** Google Fonts family name for headings (--font-serif). */
  headingFamily: string;
  /** Google Fonts family name for body copy (--font-sans). */
  bodyFamily: string;
  /** URL-safe form of headingFamily (spaces → +). Cached so we don't
   *  recompute on every render. */
  headingUrlName: string;
  /** URL-safe form of bodyFamily. */
  bodyUrlName: string;
  /** Optional fallback stack appended after the family name in CSS. */
  headingFallback: string;
  bodyFallback: string;
}

function pair(
  id: string,
  label: string,
  description: string,
  headingFamily: string,
  bodyFamily: string,
  opts: { headingSerif?: boolean; bodySerif?: boolean } = {},
): FontPair {
  const headingFallback = opts.headingSerif === false ? 'system-ui, sans-serif' : 'Georgia, serif';
  const bodyFallback = opts.bodySerif === true ? 'Georgia, serif' : 'system-ui, sans-serif';
  return {
    id,
    label,
    description,
    headingFamily,
    bodyFamily,
    headingUrlName: headingFamily.replace(/\s+/g, '+'),
    bodyUrlName: bodyFamily.replace(/\s+/g, '+'),
    headingFallback,
    bodyFallback,
  };
}

export const FONT_PAIRS: FontPair[] = [
  pair(
    'classic-sans',
    'Classic Sans',
    'Warm and welcoming. Reads well at every size — a safe default for any parish.',
    'Lora',
    'Open Sans',
  ),
  pair(
    'editorial-serif',
    'Editorial Serif',
    "Traditional parish look. Saint Helen's original pair.",
    'Libre Baskerville',
    'Libre Franklin',
  ),
  pair(
    'modern-editorial',
    'Modern Editorial',
    'Confident and contemporary. Newer parishes, suburban builds.',
    'Crimson Pro',
    'Inter',
    { bodySerif: false },
  ),
  pair(
    'display-serif',
    'Display Serif',
    'High-drama headlines for screens that need to read across the room.',
    'Playfair Display',
    'Source Sans 3',
  ),
  pair(
    'refined',
    'Refined',
    'Quiet and contemplative. Adoration chapels, retreat houses.',
    'Cormorant Garamond',
    'Lato',
  ),
  pair(
    'readable',
    'Readable',
    'Highest-legibility classic. Older demographics, accessibility focus.',
    'Merriweather',
    'Inter',
  ),
];

export const DEFAULT_PAIR_ID = 'classic-sans';

export function getFontPair(id: string | null | undefined): FontPair {
  if (!id) return FONT_PAIRS[0];
  return FONT_PAIRS.find((p) => p.id === id) ?? FONT_PAIRS[0];
}

/**
 * Builds a Google Fonts CSS2 URL that pulls both families in the weights
 * the slide templates actually use (400 + 600 for body; 400 + 700 for
 * headings). Italic is included for the body face since WelcomeQuote /
 * General use it.
 */
export function googleFontsUrlForPair(p: FontPair): string {
  const params = new URLSearchParams();
  params.append(
    'family',
    `${p.headingUrlName}:ital,wght@0,400;0,600;0,700;1,400`.replace(/%2B/g, '+'),
  );
  params.append(
    'family',
    `${p.bodyUrlName}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`.replace(/%2B/g, '+'),
  );
  params.append('display', 'swap');
  // URLSearchParams encodes `+` as %2B which Google Fonts won't accept —
  // family names need literal + as the space separator.
  return `https://fonts.googleapis.com/css2?${params.toString().replace(/%2B/g, '+')}`;
}

export function fontStackForPair(p: FontPair): {
  headingStack: string;
  bodyStack: string;
} {
  return {
    headingStack: `"${p.headingFamily}", ${p.headingFallback}`,
    bodyStack: `"${p.bodyFamily}", ${p.bodyFallback}`,
  };
}
