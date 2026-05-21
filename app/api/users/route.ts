import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenantUsers } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantUserRole } from '@/lib/auth/allowlist';

/**
 * Tenant user management. Only `owner` role can mutate the list.
 * GET is restricted to authenticated owners as well — the member list
 * isn't sensitive, but it's tenant-private.
 */

async function requireOwner() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') return { error: 'Unauthorized', status: 401 };
  // Dev bypass is treated as owner so local development still works.
  if (process.env.AUTH_DEV_BYPASS === '1') return { ok: true as const, session };
  const email = session?.user?.email ?? '';
  const role = await getTenantUserRole(email);
  if (role !== 'owner') return { error: 'Forbidden', status: 403 };
  return { ok: true as const, session };
}

export async function GET() {
  const guard = await requireOwner();
  if ('error' in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json([]);
  const rows = await db.query.tenantUsers.findMany({
    where: eq(tenantUsers.tenantId, tenant.id),
    orderBy: [asc(tenantUsers.createdAt)],
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const guard = await requireOwner();
  if ('error' in guard) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json()) as { email?: string; role?: string };
  const email = (body.email ?? '').toLowerCase().trim();
  const role = body.role === 'owner' ? 'owner' : 'editor';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Idempotent — re-inviting an existing email is a no-op + 200.
  const existing = await db.query.tenantUsers.findFirst({
    where: eq(tenantUsers.email, email),
  });
  if (existing && existing.tenantId === tenant.id) {
    return Response.json(existing);
  }

  const [created] = await db
    .insert(tenantUsers)
    .values({
      tenantId: tenant.id,
      email,
      role,
      addedBy: guard.session?.user?.email ?? null,
    })
    .returning();

  await logAudit({
    tenantId: tenant.id,
    userId: guard.session?.user?.id,
    userEmail: guard.session?.user?.email ?? undefined,
    action: 'user.invite',
    targetType: 'tenant_user',
    targetId: created.id,
    metadata: { email, role },
  });

  return Response.json(created, { status: 201 });
}
