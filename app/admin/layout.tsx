import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect('/login' as any);
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav user={session?.user ?? null} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
