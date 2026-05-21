import { getAllRecentErrors } from '@/lib/db/super-queries';
import { SuperErrorsList } from '@/components/super/SuperErrorsList';

export default async function SuperErrorsPage() {
  const rows = await getAllRecentErrors(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-cream font-bold leading-none">Errors</h1>
        <p className="mt-2 text-sm text-cream/55">
          Runtime issues captured from every player, admin, and API route on every parish.
          Newest first. Last {rows.length}.
        </p>
      </div>

      <SuperErrorsList
        errors={rows.map((e) => ({
          id: e.id,
          source: e.source,
          message: e.message,
          stack: e.stack,
          context: e.context,
          displayId: e.displayId,
          slideId: e.slideId,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
          tenantId: e.tenantId,
          tenantName: e.tenantName,
        }))}
      />
    </div>
  );
}
