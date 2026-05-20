import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenantUsers, settings } from '@/lib/db/schema';
import { getDefaultTenant } from '@/lib/db/queries';
import { UsersList } from '@/components/admin/UsersList';

export default async function UsersPage() {
  const tenant = await getDefaultTenant();
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
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Users</h1>
        <p className="mt-2 text-sm text-navy/55">
          Who can sign in to this tenant. Anyone at the staff domain gets in automatically;
          others need an explicit invite below.
        </p>
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
