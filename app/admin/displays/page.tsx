import { getDefaultTenant, getDisplaysByTenant } from '@/lib/db/queries';
import { DisplayManager } from '@/components/admin/DisplayManager';

export default async function DisplaysPage() {
  const tenant = await getDefaultTenant();
  const displays = tenant ? await getDisplaysByTenant(tenant.id) : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy">Displays</h1>
        <p className="text-muted-foreground mt-1">Manage physical screens. Copy the URL and program it into OptiSigns.</p>
      </div>
      <DisplayManager displays={displays} />
    </div>
  );
}
