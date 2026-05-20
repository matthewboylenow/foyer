'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ImageUpload } from './ImageUpload';

interface LogoSectionProps {
  initialLogoId: string | null;
  initialLogoUrl: string | null;
}

export function LogoSection({ initialLogoUrl }: LogoSectionProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);

  async function saveLogoId(id: string | null) {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoMediaId: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(id ? 'Logo updated' : 'Logo removed');
    } catch (err) {
      toast.error(`Couldn't save: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  async function handleUploaded({ id, blobUrl }: { id: string; blobUrl: string }) {
    setLogoUrl(blobUrl);
    await saveLogoId(id);
  }

  async function handleCleared() {
    setLogoUrl(null);
    await saveLogoId(null);
  }

  return (
    <div>
      <ImageUpload
        label="Logo (light variant for dark backgrounds)"
        type="logo"
        currentUrl={logoUrl}
        onUploaded={handleUploaded}
        onCleared={handleCleared}
      />
      {/* Show a navy-background preview so user sees how the logo lands on the slide */}
      {logoUrl && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">On the Parish Identity background:</p>
          <div
            className="rounded-md flex items-center justify-center bg-navy-900"
            style={{ width: '100%', maxWidth: 320, height: 120 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Logo on navy"
              className="max-w-[60%] max-h-[80%] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
