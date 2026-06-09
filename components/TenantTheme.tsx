import type { CSSProperties } from 'react';
import { getCurrentTenant } from '@/lib/tenant';
import { getSettingsByTenant } from '@/lib/db/queries';
import { getFontPair, googleFontsUrlForPair, fontStackForPair } from '@/lib/fonts';

/**
 * Saint Helen brand defaults — used when a tenant hasn't set a custom
 * palette yet. These match the original hardcoded values in globals.css
 * so behavior is byte-identical for un-themed tenants.
 */
const DEFAULTS = {
  navy: '#1F346D',
  rust: '#CD5334',
  cream: '#FAF9F7',
  gold: '#D4AF37',
} as const;

/**
 * Mixes two hex colors using the simple linear-RGB approximation. Used to
 * derive light/dark shades from the four base palette tokens so a tenant
 * doesn't have to set every -50/-100/-700/-900 swatch by hand.
 *
 * `t` is 0..1 where 0 = the base color and 1 = the target (usually #fff
 * or #000). Approximate but good enough for UI tinting.
 */
function mix(hex: string, target: string, t: number): string {
  const h = hex.replace('#', '');
  const tgt = target.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const tr = parseInt(tgt.slice(0, 2), 16);
  const tg = parseInt(tgt.slice(2, 4), 16);
  const tb = parseInt(tgt.slice(4, 6), 16);
  const mr = Math.round(r + (tr - r) * t);
  const mg = Math.round(g + (tg - g) * t);
  const mb = Math.round(b + (tb - b) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mr)}${toHex(mg)}${toHex(mb)}`;
}

/**
 * Server component. Reads tenant settings and renders a wrapping div that
 * overrides the brand CSS variables. Existing Tailwind classes
 * (`text-navy`, `bg-rust`, …) compile to `var(--color-navy)` so they pick
 * up the override automatically — no template changes required.
 *
 * Derived shades (navy-50 / navy-700 / etc.) are computed by mixing the
 * base color toward white/black so tenants don't have to set every swatch.
 */
export async function TenantTheme({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsByTenant(tenant.id) : null;

  const navy = settings?.primaryColor || DEFAULTS.navy;
  const rust = settings?.accentColor || DEFAULTS.rust;
  const cream = settings?.creamColor || DEFAULTS.cream;
  const gold = settings?.goldColor || DEFAULTS.gold;

  // Tenant's slide font pair — drives --font-serif / --font-sans below.
  // Unknown / null ids fall back to the first pair in FONT_PAIRS.
  const pair = getFontPair(settings?.fontPair);
  const { headingStack, bodyStack } = fontStackForPair(pair);
  const googleFontsHref = googleFontsUrlForPair(pair);

  // Derived navy shades — 50 (very light) through 900 (very dark).
  const style = {
    '--color-navy': navy,
    '--color-navy-50': mix(navy, '#ffffff', 0.88),
    '--color-navy-100': mix(navy, '#ffffff', 0.72),
    '--color-navy-500': navy,
    '--color-navy-700': mix(navy, '#000000', 0.22),
    '--color-navy-900': mix(navy, '#000000', 0.55),
    '--color-rust': rust,
    '--color-rust-50': mix(rust, '#ffffff', 0.88),
    '--color-rust-100': mix(rust, '#ffffff', 0.72),
    '--color-rust-500': rust,
    '--color-rust-700': mix(rust, '#000000', 0.22),
    '--color-cream': cream,
    '--color-gold': gold,
    // Brightened variant used for gold *text* on dark/tinted backgrounds —
    // same 25%-toward-white lift as the #DFC369 default in globals.css.
    '--color-gold-bright': mix(gold, '#ffffff', 0.25),
    // Override the variables the root layout sets via next/font. Tailwind's
    // font-serif / font-sans utility classes resolve to var(--font-serif)
    // / var(--font-sans), so the whole subtree (admin previews + the
    // player) picks up the tenant's choice automatically.
    '--font-serif': headingStack,
    '--font-sans': bodyStack,
  } as CSSProperties;

  return (
    <>
      {/* Preconnect speeds up the font fetch by ~100ms on cold loads.
          The stylesheet itself loads the chosen family in the weights
          slide templates use. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={googleFontsHref} />
      <div style={style} className="contents">
        {children}
      </div>
    </>
  );
}
