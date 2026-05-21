import { getTenantsOverview } from '@/lib/db/super-queries';
import { TimeAgo } from '@/components/admin/TimeAgo';

export default async function SuperTenantsPage() {
  const rows = await getTenantsOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-cream font-bold leading-none">Tenants</h1>
        <p className="mt-2 text-sm text-cream/55">
          Every parish with detail counts. Newer parishes first.
        </p>
      </div>

      <div className="rounded-xl border border-cream/10 bg-black/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-cream/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Parish</th>
              <th className="px-4 py-2 text-right font-medium">Slides</th>
              <th className="px-4 py-2 text-right font-medium">Displays</th>
              <th className="px-4 py-2 text-right font-medium">Users</th>
              <th className="px-4 py-2 text-right font-medium">Media</th>
              <th className="px-4 py-2 text-right font-medium">Errors&nbsp;24h</th>
              <th className="px-4 py-2 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-cream">{r.name}</div>
                  <div className="text-[11px] text-cream/45 font-mono">{r.slug}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-cream/85">
                  {r.activeSlideCount}
                  <span className="text-cream/35"> / {r.slideCount}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-cream/85">
                  {r.activeDisplayCount}
                  <span className="text-cream/35"> / {r.displayCount}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-cream/85">{r.userCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-cream/85">{r.mediaCount}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    r.errorCount24h > 0 ? 'text-rust font-medium' : 'text-cream/40'
                  }`}
                >
                  {r.errorCount24h}
                </td>
                <td className="px-4 py-3 text-right text-cream/60 text-xs font-mono">
                  <TimeAgo
                    date={
                      r.createdAt instanceof Date
                        ? r.createdAt.toISOString()
                        : String(r.createdAt)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
