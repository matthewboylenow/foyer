import { getCurrentTenant } from '@/lib/tenant';
import { getRecentAuditLog, getSlideTitles } from '@/lib/db/queries';
import { AuditList } from '@/components/admin/AuditList';

export default async function AuditPage() {
  const tenant = await getCurrentTenant();
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
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Activity</h1>
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
