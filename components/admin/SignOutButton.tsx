'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })} className={className}>
      <span className="inline-flex items-center gap-2">
        <LogOut size={14} />
        Sign out
      </span>
    </button>
  );
}
