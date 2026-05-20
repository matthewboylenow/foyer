import { getDefaultTenant, getRecentAuditLog, getSlideTitles } from '@/lib/db/queries';
import { AuditList } from '@/components/admin/AuditList';

export default async function AuditPage() {
  const tenant = await getDefaultTenant();
  if (!tenant) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Activity</h1>
        <p className="mt-2 text-navy/55 text-sm">No tenant configured.</p>
      </div>
    );
  }

  const [entries, slideTitles] = await Promise.all([
    getRecentAuditLog(tenant.id, 200),
    getSlideTitles(tenant.id),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Activity</h1>
        <p className="mt-2 text-sm text-navy/55">
          Recent changes to slides and collections. Expand a row to see field-by-field
          diffs. Last 200 entries.
        </p>
      </div>
      <AuditList
        entries={entries.map((e) => ({
          id: e.id,
          userEmail: e.userEmail,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          metadata: e.metadata,
          createdAt:
            e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
        }))}
        slideTitles={slideTitles}
      />
    </div>
  );
}
