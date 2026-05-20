import { getDefaultTenant, getRecentErrors, getDisplaysByTenant, getSlideTitles } from '@/lib/db/queries';
import { ErrorsList } from '@/components/admin/ErrorsList';

export default async function ErrorsPage() {
  const tenant = await getDefaultTenant();
  if (!tenant) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Errors</h1>
        <p className="mt-2 text-navy/55 text-sm">No tenant configured.</p>
      </div>
    );
  }

  const [errors, displays, slideTitles] = await Promise.all([
    getRecentErrors(tenant.id, 200),
    getDisplaysByTenant(tenant.id),
    getSlideTitles(tenant.id),
  ]);
  const displayNames = Object.fromEntries(displays.map((d) => [d.id, d.name]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Errors</h1>
        <p className="mt-2 text-sm text-navy/55">
          Runtime issues captured from the player, the admin, and API routes. Newest first.
          Most recent {errors.length} shown.
        </p>
      </div>
      <ErrorsList
        errors={errors.map((e) => ({
          ...e,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
        }))}
        displayNames={displayNames}
        slideTitles={slideTitles}
      />
    </div>
  );
}
