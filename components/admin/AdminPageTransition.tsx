'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Subtle fade between admin routes. Composite-only (opacity + tiny y) so
 * it stays cheap even on lower-end Codespaces / iPad-served sessions.
 * Avoids `filter: blur(...)` per [[signage-perf-constraints]].
 */
export function AdminPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);

  useEffect(() => {
    setKey(pathname);
  }, [pathname]);

  return (
    <div key={key} className="admin-page-enter">
      {children}
    </div>
  );
}
