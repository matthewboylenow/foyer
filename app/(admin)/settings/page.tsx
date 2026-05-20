import { auth } from '@/lib/auth/config';
import { getDefaultTenant, getSettingsByTenant } from '@/lib/db/queries';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth/config';

export default async function SettingsPage() {
  const session = await auth();
  const tenant = await getDefaultTenant();
  const settings = tenant ? await getSettingsByTenant(tenant.id) : null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy">Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Brand */}
        <section className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Brand</h2>
          <p className="text-sm text-muted-foreground">
            Brand colors are locked to Saint Helen values in v1. Logo upload coming soon.
          </p>
          <div className="flex gap-3">
            {[
              { label: 'Navy', hex: '#1F346D' },
              { label: 'Rust', hex: '#CD5334' },
              { label: 'Cream', hex: '#FAF9F7' },
              { label: 'Gold', hex: '#D4AF37' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full border border-border"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Rotation */}
        {settings && (
          <section className="border border-border rounded-lg p-6">
            <h2 className="font-medium mb-4">Rotation</h2>
            <SettingsForm settings={settings} />
          </section>
        )}

        {/* Account */}
        <section className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Account</h2>
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{session?.user?.email ?? 'Unknown'}</p>
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
