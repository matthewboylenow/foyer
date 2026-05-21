import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isSuperAdmin } from '@/lib/auth/super';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminPageTransition } from '@/components/admin/AdminPageTransition';
import { TenantTheme } from '@/components/TenantTheme';

// Admin pages must always reflect the latest DB state — no CDN caching of HTML.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect('/login' as any);
  }

  // In dev bypass mode, treat the bypassed user as super-admin so the link
  // is reachable without configuring SUPER_ADMIN_EMAILS.
  const devBypass = process.env.AUTH_DEV_BYPASS === '1';
  const userIsSuper = devBypass || isSuperAdmin(session?.user?.email);

  return (
    <TenantTheme>
      <div className="min-h-screen bg-cream">
        <AdminNav user={session?.user ?? null} isSuperAdmin={userIsSuper} />
        <main className="lg:ml-56 px-4 sm:px-8 py-8 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <AdminPageTransition>{children}</AdminPageTransition>
          </div>
        </main>
      </div>
    </TenantTheme>
  );
}
