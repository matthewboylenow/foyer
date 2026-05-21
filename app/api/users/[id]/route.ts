import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenantUsers } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantUserRole } from '@/lib/auth/allowlist';

async function requireOwner() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') return { error: 'Unauthorized', status: 401 };
  if (process.env.AUTH_DEV_BYPASS === '1') return { ok: true as const, session };
  const email = session?.user?.email ?? '';
  const role = await getTenantUserRole(email);
  if (role !== 'owner') return { error: 'Forbidden', status: 403 };
  return { ok: true as const, session };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireOwner();
  if ('error' in guard) return Response.json({ error: guard.error }, { status: guard.status });
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { id } = await params;
  const body = (await req.json()) as { role?: string };
  if (body.role !== 'owner' && body.role !== 'editor') {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  const [updated] = await db
    .update(tenantUsers)
    .set({ role: body.role })
    .where(and(eq(tenantUsers.id, id), eq(tenantUsers.tenantId, tenant.id)))
    .returning();
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  await logAudit({
    tenantId: tenant.id,
    userId: guard.session?.user?.id,
    userEmail: guard.session?.user?.email ?? undefined,
    action: 'user.role',
    targetType: 'tenant_user',
    targetId: id,
    metadata: { email: updated.email, role: updated.role },
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireOwner();
  if ('error' in guard) return Response.json({ error: guard.error }, { status: guard.status });
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { id } = await params;
  const existing = await db.query.tenantUsers.findFirst({
    where: and(eq(tenantUsers.id, id), eq(tenantUsers.tenantId, tenant.id)),
  });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  // Refuse to remove the last owner — would lock everyone out of user mgmt.
  if (existing.role === 'owner') {
    const owners = await db.query.tenantUsers.findMany({
      where: and(eq(tenantUsers.tenantId, tenant.id), eq(tenantUsers.role, 'owner')),
    });
    if (owners.length <= 1) {
      return Response.json(
        { error: 'Cannot remove the last owner. Promote another user first.' },
        { status: 400 },
      );
    }
  }

  await db.delete(tenantUsers).where(eq(tenantUsers.id, id));

  await logAudit({
    tenantId: tenant.id,
    userId: guard.session?.user?.id,
    userEmail: guard.session?.user?.email ?? undefined,
    action: 'user.remove',
    targetType: 'tenant_user',
    targetId: id,
    metadata: { email: existing.email },
  });

  return new Response(null, { status: 204 });
}
