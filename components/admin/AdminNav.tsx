'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import {
  LayoutGrid,
  CalendarDays,
  Monitor,
  Activity,
  AlertTriangle,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavLink {
  href:
    | '/admin/slides'
    | '/admin/schedule'
    | '/admin/displays'
    | '/admin/audit'
    | '/admin/errors'
    | '/admin/users'
    | '/admin/settings';
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_LINKS: NavLink[] = [
  { href: '/admin/slides', label: 'Slides', icon: LayoutGrid },
  { href: '/admin/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/admin/displays', label: 'Displays', icon: Monitor },
  { href: '/admin/audit', label: 'Activity', icon: Activity },
  { href: '/admin/errors', label: 'Errors', icon: AlertTriangle },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

interface AdminNavProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}

export function AdminNav({ user }: AdminNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — fixed left rail in navy with cream/gold accents */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-56 flex-col bg-navy-900 text-cream/85 z-40 border-r border-cream/5">
        <div className="px-6 pt-7 pb-5">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/admin/slides' as any}
            className="block font-serif text-cream font-bold text-2xl tracking-tight leading-none"
          >
            Foyer
          </Link>
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-gold/70 font-medium">
            Saint Helen
          </div>
        </div>

        <div className="px-3 mt-2">
          <div className="h-px bg-gold/15 mx-3" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={link.href as any}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-cream text-navy font-semibold shadow-sm'
                    : 'text-cream/75 hover:text-cream hover:bg-cream/5'
                }`}
              >
                <Icon size={16} className={active ? 'text-rust' : 'text-cream/55'} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-6">
          <div className="h-px bg-gold/15 mx-3 mb-4" />
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full text-left px-3 py-2 rounded-lg hover:bg-cream/5 group">
              <div className="text-[10px] uppercase tracking-widest text-cream/40 mb-0.5">
                Signed in
              </div>
              <div className="text-sm text-cream/85 truncate">
                {user?.email ?? 'User'}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-navy-900 text-cream border-b border-cream/5">
        <div className="flex items-center h-14 px-4 gap-4">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/admin/slides' as any}
            className="font-serif text-cream font-bold text-xl"
          >
            Foyer
          </Link>
          <button
            className="ml-auto p-2 text-cream/70 hover:text-cream"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-cream/5 px-3 py-3 space-y-1">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={link.href as any}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    active ? 'bg-cream text-navy font-semibold' : 'text-cream/75 hover:bg-cream/5'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={16} className={active ? 'text-rust' : 'text-cream/55'} />
                  {link.label}
                </Link>
              );
            })}
            <button
              className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm text-rust"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </header>
    </>
  );
}
