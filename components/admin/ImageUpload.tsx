'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { Upload, X, ImageIcon, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTenantSlug } from '@/lib/tenant-client';
import { MediaLibraryPicker } from './MediaLibraryPicker';
import { UploadProgress } from './UploadProgress';

interface ImageUploadProps {
  label?: string;
  type?: 'image' | 'logo';
  currentUrl?: string | null;
  onUploaded: (media: { id: string; blobUrl: string }) => void;
  onCleared?: () => void;
  accept?: string;
  maxSizeMB?: number;
}

export function ImageUpload({
  label = 'Upload image',
  type = 'image',
  currentUrl,
  onUploaded,
  onCleared,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml',
  maxSizeMB = 10,
}: ImageUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tenantSlug = useTenantSlug();

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large (max ${maxSizeMB} MB)`);
      return;
    }

    setProgress(0);
    try {
      // 1. Upload directly to Vercel Blob (browser → blob storage, never
      //    through our serverless function — so the 4.5 MB body limit
      //    doesn't apply). Path is prefixed with the tenant slug so each
      //    parish's media lives in its own folder.
      const pathname = tenantSlug ? `${tenantSlug}/${file.name}` : file.name;
      const result = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/client',
        clientPayload: JSON.stringify({ type }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      // 2. Register the row in our DB and get the media id.
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          blobUrl: result.url,
          filename: file.name,
          bytes: file.size,
          type,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as { id: string; blobUrl: string };
      onUploaded({ id: row.id, blobUrl: row.blobUrl });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const uploading = progress !== null;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {uploading ? (
        <UploadProgress percent={progress ?? 0} />
      ) : currentUrl ? (
        <div className="flex items-start gap-3">
          <div className="border border-border rounded-md p-2 bg-muted/30 flex items-center justify-center" style={{ width: 120, height: 120 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="Current"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} className="mr-2" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLibraryOpen(true)}
            >
              <Library size={14} className="mr-2" />
              From library
            </Button>
            {onCleared && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCleared}
                className="text-rust"
              >
                <X size={14} className="mr-2" />
                Remove
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-md p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-navy hover:text-navy transition-colors"
          >
            <ImageIcon size={24} />
            <span className="text-sm">Click to upload</span>
            <span className="text-xs">PNG, JPG, WebP, or SVG · max {maxSizeMB} MB</span>
          </button>
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="w-full text-xs text-muted-foreground hover:text-navy transition-colors py-1 flex items-center justify-center gap-1.5"
          >
            <Library size={12} />
            or choose from library
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        filter="image-or-logo"
        onSelect={({ id, blobUrl }) => onUploaded({ id, blobUrl })}
      />
    </div>
  );
}
