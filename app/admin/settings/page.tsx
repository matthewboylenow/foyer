import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { getSettingsWithMedia } from '@/lib/db/queries';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { LogoSection } from '@/components/admin/LogoSection';
import { PaletteEditor } from '@/components/admin/PaletteEditor';
import { FontPairPicker } from '@/components/admin/FontPairPicker';
import { EmailFromEditor } from '@/components/admin/EmailFromEditor';
import { AlertSettingsEditor } from '@/components/admin/AlertSettingsEditor';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth/config';

export default async function SettingsPage() {
  const session = await auth();
  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const envFromFallback =
    process.env.EMAIL_FROM?.trim().replace(/^["']|["']$/g, '') ??
    'Saint Helen Signage <no-reply@sending.sainthelen.org>';

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Settings</h1>
        <p className="mt-2 text-sm text-navy/55">
          Brand, palette, sender. Changes apply to every slide and every display under this tenant.
        </p>
      </div>

      <div className="space-y-8">
        {/* Logo */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Logo</h2>
            <p className="text-sm text-navy/55 mt-1">
              Used on the Parish Identity slide. Transparent PNG or SVG, light strokes for dark
              backgrounds.
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
              Tenant-wide color tokens. Light and dark shades are derived automatically — set
              the four base colors and the whole admin + every TV display picks them up.
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
              The typeface pair the templates use. Pick one that feels right for your
              parish — the admin still uses these too. We&apos;re working on splitting the
              admin chrome onto its own brand font in a coming update.
            </p>
          </div>
          <FontPairPicker initial={settings?.fontPair ?? 'classic-sans'} />
        </section>

        {/* Email sender */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Email sender</h2>
            <p className="text-sm text-navy/55 mt-1">
              The display name + address used for sign-in OTP emails. Per-tenant override of
              the <code className="font-mono">EMAIL_FROM</code> env var.
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
              Get an email when a TV stops checking in, and another when it is back. Uses
              the sender above.
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

        {/* Account */}
        <section className="rounded-xl border border-navy/10 bg-cream p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-navy">Account</h2>
          <div>
            <p className="text-sm text-navy/55">Signed in as</p>
            <p className="font-medium text-navy">{session?.user?.email ?? 'Unknown'}</p>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="outline" className="text-rust border-rust">
              Sign out
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
