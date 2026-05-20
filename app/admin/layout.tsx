import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminPageTransition } from '@/components/admin/AdminPageTransition';

// Admin pages must always reflect the latest DB state — no CDN caching of HTML.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect('/login' as any);
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={session?.user ?? null} />
      <main className="lg:ml-56 px-4 sm:px-8 py-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <AdminPageTransition>{children}</AdminPageTransition>
        </div>
      </main>
    </div>
  );
}
