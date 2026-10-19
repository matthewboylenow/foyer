import { getCurrentTenant } from '@/lib/tenant';
import { getSettingsWithMedia } from '@/lib/db/queries';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { LogoSection } from '@/components/admin/LogoSection';
import { PaletteEditor } from '@/components/admin/PaletteEditor';
import { FontPairPicker } from '@/components/admin/FontPairPicker';
import { EmailFromEditor } from '@/components/admin/EmailFromEditor';
import { AlertSettingsEditor } from '@/components/admin/AlertSettingsEditor';

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const envFromFallback =
    process.env.EMAIL_FROM?.trim().replace(/^["']|["']$/g, '') ??
    'Saint Helen Signage <no-reply@sending.sainthelen.org>';

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Logo */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Logo</h2>
            <p className="text-sm text-navy/55 mt-1">
              Shown on the Parish Identity slide. Transparent PNG or SVG.
            </p>
          </div>
          <LogoSection
            initialLogoId={settings?.logoMediaId ?? null}
            initialLogoUrl={settings?.logoMedia?.blobUrl ?? null}
          />
        </section>

        {/* Palette */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Palette</h2>
            <p className="text-sm text-navy/55 mt-1">
              Four base colors. Lighter and darker shades are derived from them.
            </p>
          </div>
          <PaletteEditor
            initial={{
              primaryColor: settings?.primaryColor ?? '#1F346D',
              accentColor: settings?.accentColor ?? '#CD5334',
              creamColor: settings?.creamColor ?? '#FAF9F7',
              goldColor: settings?.goldColor ?? '#D4AF37',
            }}
          />
        </section>

        {/* Fonts */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Slide fonts</h2>
            <p className="text-sm text-navy/55 mt-1">
              The typeface pair used on every slide.
            </p>
          </div>
          <FontPairPicker initial={settings?.fontPair ?? 'classic-sans'} />
        </section>

        {/* Email sender */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Email sender</h2>
            <p className="text-sm text-navy/55 mt-1">
              Sign-in codes and alerts are sent from this address.
            </p>
          </div>
          <EmailFromEditor
            initial={{
              emailFromName: settings?.emailFromName ?? null,
              emailFromAddress: settings?.emailFromAddress ?? null,
            }}
            envFallback={envFromFallback}
          />
        </section>

        {/* Downtime alerts */}
        <section id="alerts" className="rounded-xl border border-navy/10 bg-cream p-6 space-y-5 scroll-mt-8">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Screen alerts</h2>
            <p className="text-sm text-navy/55 mt-1">
              An email when a TV stops checking in, and another when it is back.
            </p>
          </div>
          <AlertSettingsEditor
            initial={{
              alertEmails: settings?.alertEmails ?? null,
              alertOfflineAfterMin: settings?.alertOfflineAfterMin ?? 10,
            }}
          />
        </section>

        {/* Rotation */}
        {settings && (
          <section className="rounded-xl border border-navy/10 bg-cream p-6">
            <h2 className="font-serif text-lg font-semibold text-navy mb-4">Rotation</h2>
            <SettingsForm settings={settings} />
          </section>
        )}

      </div>
    </div>
  );
}
