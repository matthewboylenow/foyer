import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sourceDeliveries, sourceItems } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { SourceItemsList } from '@/components/admin/SourceItemsList';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const tenant = await getCurrentTenant();
  const [items, deliveries] = tenant
    ? await Promise.all([
        db.query.sourceItems.findMany({
          where: eq(sourceItems.tenantId, tenant.id),
          orderBy: [desc(sourceItems.lastReceivedAt)],
        }),
        db.query.sourceDeliveries.findMany({
          where: eq(sourceDeliveries.tenantId, tenant.id),
          orderBy: [desc(sourceDeliveries.receivedAt)],
          limit: 15,
        }),
      ])
    : [[], []];
  const configured = !!process.env.WORDPRESS_SYNC_SECRET;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">From WordPress</h1>
        <p className="mt-2 text-sm text-navy/55">
          Announcements approved on the website and marked for the screens. WordPress owns
          the words; here you can hide one or change how it plays. They go live as they
          arrive and skip the publish step.
        </p>
        {!configured && (
          <p className="mt-3 text-sm text-rust">
            WORDPRESS_SYNC_SECRET is not set on the server, so the website cannot deliver
            anything yet.
          </p>
        )}
      </div>
      <SourceItemsList items={items} deliveries={deliveries} />
    </div>
  );
}
