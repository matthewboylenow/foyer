import { auth } from './config';
import { db } from '@/lib/db/client';
import { auditLog } from '@/lib/db/schema';

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function logAudit(params: {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values(params);
}
