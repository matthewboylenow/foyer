'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { Upload, X, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTenantSlug } from '@/lib/tenant-client';
import { captureVideoPoster } from '@/lib/videoPoster';
import { optimizeVideoFile } from '@/lib/optimizeVideo';
import { UploadProgress } from './UploadProgress';

interface VideoUploadProps {
  label?: string;
  currentUrl?: string | null;
  /** Poster frame captured at upload time — shown instead of streaming the video. */
  currentPosterUrl?: string | null;
  onUploaded: (media: { id: string; blobUrl: string; posterUrl: string | null }) => void;
  onCleared?: () => void;
  maxSizeMB?: number;
}

export function VideoUpload({
  label = 'Upload video',
  currentUrl,
  currentPosterUrl,
  onUploaded,
  onCleared,
  maxSizeMB = 15,
}: VideoUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'optimizing' | 'uploading'>('uploading');
  const inputRef = useRef<HTMLInputElement>(null);
  const tenantSlug = useTenantSlug();

  async function handleFile(original: File) {
    // Hard input ceiling — beyond this, even re-encoding would mean reading
    // hundreds of MB into browser memory.
    if (original.size > 500 * 1024 * 1024) {
      toast.error('File too large (max 500 MB input). Trim the clip first.');
      return;
    }

    // Re-encode in the browser: 1920px long edge, ~5 Mbps H.264, audio
    // stripped (signage plays muted). Big phone clips come out a few MB;
    // already-small files pass through untouched.
    setPhase('optimizing');
    setProgress(0);
    const file = await optimizeVideoFile(original, setProgress);

    if (file.size > maxSizeMB * 1024 * 1024) {
      setProgress(null);
      const mb = (file.size / (1024 * 1024)).toFixed(0);
      toast.error(
        file === original
          ? `File too large (max ${maxSizeMB} MB) and this browser can't compress it. Re-encode at ~5 Mbps or use Chrome/Edge.`
          : `Still ${mb} MB after compression (max ${maxSizeMB} MB) — use a shorter loop (5–15s).`,
      );
      return;
    }
    if (file.size < original.size * 0.9) {
      const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
      toast.info(`Compressed ${mb(original.size)} → ${mb(file.size)} before upload`);
    }

    setPhase('uploading');
    setProgress(0);
    try {
      const pathname = tenantSlug ? `${tenantSlug}/${file.name}` : file.name;
      const result = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/client',
        clientPayload: JSON.stringify({ type: 'video' }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      // Screen-grab a poster frame from the LOCAL file (no download) so
      // admin previews never need to stream the video from Blob.
      let posterUrl: string | null = null;
      const posterBlob = await captureVideoPoster(file);
      if (posterBlob) {
        try {
          const posterName = `${file.name.replace(/\.[^.]+$/, '')}.poster.webp`;
          const posterPath = tenantSlug ? `${tenantSlug}/${posterName}` : posterName;
          const posterResult = await upload(
            posterPath,
            new File([posterBlob], posterName, { type: 'image/webp' }),
            {
              access: 'public',
              handleUploadUrl: '/api/upload/client',
              clientPayload: JSON.stringify({ type: 'image' }),
            },
          );
          posterUrl = posterResult.url;
        } catch {
          // Poster is an optimization — never fail the video upload over it.
        }
      }

      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          blobUrl: result.url,
          posterUrl,
          filename: file.name,
          bytes: file.size,
          type: 'video',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as { id: string; blobUrl: string; posterUrl: string | null };
      onUploaded({ id: row.id, blobUrl: row.blobUrl, posterUrl: row.posterUrl ?? null });
      toast.success('Video uploaded');
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
        <UploadProgress
          percent={progress ?? 0}
          label={phase === 'optimizing' ? 'Compressing video…' : 'Uploading video…'}
        />
      ) : currentUrl ? (
        <div className="flex items-start gap-3">
          {/* preload=none + poster: zero video bytes until the admin
              actually presses play. Legacy uploads without a poster fall
              back to preload=metadata (a few KB) so the box isn't blank. */}
          <video
            src={currentUrl}
            muted
            loop
            playsInline
            controls
            preload={currentPosterUrl ? 'none' : 'metadata'}
            poster={currentPosterUrl ?? undefined}
            className="border border-border rounded-md bg-muted/30 object-cover"
            style={{ width: 160, height: 90 }}
          />
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-md p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-navy hover:text-navy transition-colors"
        >
          <Film size={24} />
          <span className="text-sm">Click to upload</span>
          <span className="text-xs text-center">
            MP4 / MOV / WebM · 5–15s loop · large files are compressed automatically
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
