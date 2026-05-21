import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { isSuperAdmin } from '@/lib/auth/super';
import { SignOutButton } from '@/components/admin/SignOutButton';

// Operator views must always reflect live DB state.
export const dynamic = 'force-dynamic';

interface SuperNavLink {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  href: any;
  label: string;
}

const NAV: SuperNavLink[] = [
  { href: '/super', label: 'Overview' },
  { href: '/super/errors', label: 'Errors' },
  { href: '/super/tenants', label: 'Tenants' },
];

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const devBypass = process.env.AUTH_DEV_BYPASS === '1';

  if (!session && !devBypass) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect('/login' as any);
  }

  // In dev bypass mode, treat the bypassed user as a super-admin so the
  // operator UI is reachable without configuring SUPER_ADMIN_EMAILS.
  if (!devBypass && !isSuperAdmin(session?.user?.email)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0c1224] text-cream/90">
      <aside className="fixed top-0 left-0 bottom-0 w-56 flex flex-col bg-black/40 border-r border-cream/5 z-40">
        <div className="px-6 pt-7 pb-5">
          <div className="font-serif text-cream font-bold text-2xl leading-none">Foyer</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-rust font-medium">
            Operator
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((link) => (
            <Link
              key={String(link.href)}
              href={link.href}
              className="block px-3 py-2 rounded-lg text-sm text-cream/75 hover:text-cream hover:bg-cream/5"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-6 space-y-2">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/admin/slides' as any}
            className="block px-3 py-2 rounded-lg text-sm text-cream/55 hover:text-cream hover:bg-cream/5"
          >
            ← Back to tenant admin
          </Link>
          <div className="px-3 py-2 rounded-lg text-[11px] text-cream/40">
            <div className="uppercase tracking-widest mb-0.5">Signed in</div>
            <div className="text-cream/70 truncate">
              {session?.user?.email ?? 'dev bypass'}
            </div>
          </div>
          <SignOutButton className="w-full text-left px-3 py-2 rounded-lg text-sm text-rust hover:bg-cream/5" />
        </div>
      </aside>
      <main className="ml-56 px-8 py-8 min-h-screen">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
