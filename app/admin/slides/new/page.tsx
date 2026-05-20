import Link from 'next/link';
import { templates } from '@/components/templates';
import type { TemplateKey } from '@/components/templates';

const TEMPLATE_DESCRIPTIONS: Record<TemplateKey, string> = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.description]),
) as Record<TemplateKey, string>;

// Simple SVG thumbnail color map per template mood
const TEMPLATE_COLORS: Record<TemplateKey, { bg: string; fg: string }> = {
  parish_identity: { bg: '#1F346D', fg: '#FAF9F7' },
  welcome_quote: { bg: '#FAF9F7', fg: '#1F346D' },
  general: { bg: '#FAF9F7', fg: '#1F346D' },
  mass_schedule: { bg: '#FAF9F7', fg: '#CD5334' },
  weekly_association: { bg: '#FAF9F7', fg: '#1F346D' },
  sanctuary_candle: { bg: '#0B0D12', fg: '#D4AF37' },
  app_promo: { bg: '#16264E', fg: '#FAF9F7' },
};

export default function NewSlidePage() {
  const templateKeys = Object.keys(templates) as TemplateKey[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy">New Slide</h1>
        <p className="text-muted-foreground mt-1">Choose a template to get started.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templateKeys.map((key) => {
          const config = templates[key];
          const colors = TEMPLATE_COLORS[key];
          return (
            <Link
              key={key}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/admin/slides/new/${key}` as any}
              className="border border-border rounded-lg overflow-hidden hover:border-navy hover:shadow-md transition-all group"
            >
              {/* Thumbnail */}
              <div
                className="h-40 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: colors.bg }}
              >
                <div className="text-center px-4">
                  <div
                    className="font-serif text-2xl font-bold mb-1"
                    style={{ color: colors.fg }}
                  >
                    {config.label.split(' ')[0]}
                  </div>
                  <div
                    className="font-sans text-xs uppercase tracking-widest opacity-60"
                    style={{ color: colors.fg }}
                  >
                    {key.replace(/_/g, ' ')}
                  </div>
                </div>
                {/* Subtle grain */}
                <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.03 }} />
              </div>

              {/* Card body */}
              <div className="p-4 bg-white group-hover:bg-muted/20 transition-colors">
                <h2 className="font-medium text-navy mb-1">{config.label}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {TEMPLATE_DESCRIPTIONS[key]}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
