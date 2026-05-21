import Link from 'next/link';
import { getTenantsOverview } from '@/lib/db/super-queries';
import { TimeAgo } from '@/components/admin/TimeAgo';
import { AlertTriangle, Building2, LayoutGrid, Monitor, Users as UsersIcon, ImageIcon } from 'lucide-react';

export default async function SuperOverviewPage() {
  const rows = await getTenantsOverview();

  const totals = rows.reduce(
    (acc, r) => ({
      tenants: acc.tenants + 1,
      slides: acc.slides + r.slideCount,
      displays: acc.displays + r.displayCount,
      users: acc.users + r.userCount,
      media: acc.media + r.mediaCount,
      errors24h: acc.errors24h + r.errorCount24h,
    }),
    { tenants: 0, slides: 0, displays: 0, users: 0, media: 0, errors24h: 0 },
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-cream font-bold leading-none">Overview</h1>
        <p className="mt-2 text-sm text-cream/55">
          Every parish running on this Foyer instance.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={Building2} label="Parishes" value={totals.tenants} />
        <Stat icon={LayoutGrid} label="Slides" value={totals.slides} />
        <Stat icon={Monitor} label="Displays" value={totals.displays} />
        <Stat icon={UsersIcon} label="Users" value={totals.users} />
        <Stat icon={ImageIcon} label="Media" value={totals.media} />
        <Stat
          icon={AlertTriangle}
          label="Errors / 24h"
          value={totals.errors24h}
          tint={totals.errors24h > 0 ? 'rust' : undefined}
        />
      </div>

      <div className="rounded-xl border border-cream/10 bg-black/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-cream/10 flex items-center justify-between">
          <h2 className="text-sm font-medium text-cream/85">Parishes</h2>
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/super/tenants' as any}
            className="text-[11px] text-cream/55 hover:text-cream"
          >
            View all →
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-cream/50 text-sm">No tenants yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-cream/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Parish</th>
                <th className="px-4 py-2 text-right font-medium">Slides</th>
                <th className="px-4 py-2 text-right font-medium">Displays</th>
                <th className="px-4 py-2 text-right font-medium">Users</th>
                <th className="px-4 py-2 text-right font-medium">Errors&nbsp;24h</th>
                <th className="px-4 py-2 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-cream/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-cream">{r.name}</div>
                    <div className="text-[11px] text-cream/45 font-mono">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.activeSlideCount}
                    <span className="text-cream/35"> / {r.slideCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.activeDisplayCount}
                    <span className="text-cream/35"> / {r.displayCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.userCount}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      r.errorCount24h > 0 ? 'text-rust font-medium' : 'text-cream/40'
                    }`}
                  >
                    {r.errorCount24h}
                  </td>
                  <td className="px-4 py-3 text-right text-cream/60 text-xs font-mono">
                    {r.lastActivityAt ? (
                      <TimeAgo
                        date={
                          r.lastActivityAt instanceof Date
                            ? r.lastActivityAt.toISOString()
                            : String(r.lastActivityAt)
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  tint?: 'rust';
}) {
  return (
    <div className="rounded-xl border border-cream/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-cream/45">
        <Icon size={12} />
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl tabular-nums ${
          tint === 'rust' && value > 0 ? 'text-rust' : 'text-cream'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
