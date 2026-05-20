'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Menu, X, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_LINKS = [
  { href: '/admin/slides', label: 'Slides' },
  { href: '/admin/displays', label: 'Displays' },
  { href: '/admin/audit', label: 'Activity' },
  { href: '/admin/settings', label: 'Settings' },
];

interface AdminNavProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}

export function AdminNav({ user }: AdminNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        {/* Logo */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={'/admin/slides' as any} className="font-serif text-navy font-bold text-xl shrink-0">
          Foyer
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={link.href as any}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith(link.href)
                  ? 'bg-navy text-cream'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User menu (desktop) */}
        <div className="hidden md:flex ml-auto items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-sm text-muted-foreground px-3 py-1 rounded hover:bg-muted">
              {user?.email ?? 'User'} ▾
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-2 text-muted-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={link.href as any}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                pathname.startsWith(link.href)
                  ? 'bg-navy text-cream'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <button
            className="block w-full text-left px-3 py-2 text-sm text-rust font-medium"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
