import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { getDisplaysByTenant, getSettingsByTenant } from '@/lib/db/queries';
import { DisplayManager } from '@/components/admin/DisplayManager';
import { parseEmailList } from '@/lib/monitoring';

export default async function DisplaysPage() {
  const tenant = await getCurrentTenant();
  const [displays, settings] = await Promise.all([
    tenant ? getDisplaysByTenant(tenant.id) : [],
    tenant ? getSettingsByTenant(tenant.id) : null,
  ]);
  const recipients = parseEmailList(settings?.alertEmails);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Displays</h1>
          <p className="text-muted-foreground mt-1">
            Every screen, whether it is up, and what it is showing. Point OptiSigns or a
            Raspberry Pi at a display&apos;s URL.
          </p>
        </div>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={'/admin/settings#alerts' as any}
          className="text-xs text-navy/60 hover:text-navy underline underline-offset-2"
        >
          {recipients.length === 0
            ? 'Downtime alerts are off — set up email alerts'
            : `Downtime alerts go to ${recipients.length} ${recipients.length === 1 ? 'address' : 'addresses'}`}
        </Link>
      </div>
      <DisplayManager displays={displays} />
    </div>
  );
}
