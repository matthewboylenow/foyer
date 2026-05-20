import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getDefaultTenant, getRecentAuditLog, getSlideTitles } from '@/lib/db/queries';
import { Badge } from '@/components/ui/badge';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'slide.create': { label: 'Created', color: 'bg-green-100 text-green-800' },
  'slide.update': { label: 'Updated', color: 'bg-navy-50 text-navy-700' },
  'slide.toggle': { label: 'Toggled', color: 'bg-amber-100 text-amber-800' },
  'slide.delete': { label: 'Deleted', color: 'bg-red-100 text-red-800' },
};

export default async function AuditPage() {
  const tenant = await getDefaultTenant();
  if (!tenant) return null;

  const [entries, slideTitles] = await Promise.all([
    getRecentAuditLog(tenant.id, 200),
    getSlideTitles(tenant.id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy">Activity log</h1>
        <p className="text-muted-foreground mt-1">
          Recent changes to slides, displays, and settings. Last 200 entries.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No activity yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Who</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => {
                const slideMeta = e.targetId ? slideTitles[e.targetId] : null;
                const actionMeta = ACTION_LABELS[e.action] ?? { label: e.action, color: 'bg-muted text-foreground' };
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td
                      className="px-4 py-3 text-muted-foreground whitespace-nowrap"
                      title={new Date(e.createdAt).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{e.userEmail ?? 'system'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${actionMeta.color}`}>
                        {actionMeta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {slideMeta && e.targetId ? (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <Link href={`/admin/slides/${e.targetId}` as any} className="text-navy hover:underline">
                          {slideMeta.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {e.targetType ?? '—'}
                          {e.targetId && ` (${e.targetId.slice(0, 8)}…)`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
