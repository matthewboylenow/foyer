import { getCurrentTenant } from '@/lib/tenant';
import { getMediaByTenant } from '@/lib/db/queries';
import { MediaLibrary } from '@/components/admin/MediaLibrary';

export default async function MediaPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Library</h1>
        <p className="mt-2 text-navy/55 text-sm">No tenant configured.</p>
      </div>
    );
  }

  const items = await getMediaByTenant(tenant.id, 'image-or-logo');

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Library</h1>
        <p className="mt-2 text-sm text-navy/55">
          Every image you&apos;ve uploaded. Reuse anything here on a slide instead of re-uploading,
          and clean up files you no longer need.
        </p>
      </div>
      <MediaLibrary
        initialItems={items.map((m) => ({
          ...m,
          uploadedAt:
            m.uploadedAt instanceof Date ? m.uploadedAt.toISOString() : String(m.uploadedAt),
        }))}
      />
    </div>
  );
}
