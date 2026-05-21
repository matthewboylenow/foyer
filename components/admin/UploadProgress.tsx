'use client';

interface UploadProgressProps {
  /** 0–100. */
  percent: number;
  /** Optional label shown above the bar — defaults to "Uploading…". */
  label?: string;
}

export function UploadProgress({ percent, label = 'Uploading…' }: UploadProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-navy transition-all duration-150 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
