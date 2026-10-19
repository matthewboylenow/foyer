import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenantUsers, settings } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { UsersList } from '@/components/admin/UsersList';

export default async function UsersPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Users</h1>
        <p className="mt-2 text-navy/55 text-sm">No tenant configured.</p>
      </div>
    );
  }

  const [users, tenantSettings] = await Promise.all([
    db.query.tenantUsers.findMany({
      where: eq(tenantUsers.tenantId, tenant.id),
      orderBy: [asc(tenantUsers.createdAt)],
    }),
    db.query.settings.findFirst({ where: eq(settings.tenantId, tenant.id) }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Users</h1>
      </div>
      <UsersList
        users={users.map((u) => ({
          ...u,
          createdAt:
            u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
        }))}
        allowedDomain={tenantSettings?.allowedDomain ?? null}
      />
    </div>
  );
}
