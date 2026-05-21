'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { Upload, X, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadProgress } from './UploadProgress';

interface VideoUploadProps {
  label?: string;
  currentUrl?: string | null;
  onUploaded: (media: { id: string; blobUrl: string }) => void;
  onCleared?: () => void;
  maxSizeMB?: number;
}

export function VideoUpload({
  label = 'Upload video',
  currentUrl,
  onUploaded,
  onCleared,
  maxSizeMB = 100,
}: VideoUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large (max ${maxSizeMB} MB). Try a shorter loop or lower bitrate.`);
      return;
    }

    setProgress(0);
    try {
      const result = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/client',
        clientPayload: JSON.stringify({ type: 'video' }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          blobUrl: result.url,
          filename: file.name,
          bytes: file.size,
          type: 'video',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as { id: string; blobUrl: string };
      onUploaded({ id: row.id, blobUrl: row.blobUrl });
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
        <UploadProgress percent={progress ?? 0} label="Uploading video…" />
      ) : currentUrl ? (
        <div className="flex items-start gap-3">
          <video
            src={currentUrl}
            autoPlay
            muted
            loop
            playsInline
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
            MP4 / WebM · 5–15s loop recommended · max {maxSizeMB} MB
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
