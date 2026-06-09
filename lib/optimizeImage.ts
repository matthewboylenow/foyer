/**
 * Client-side image optimization, run in the browser before a file is
 * uploaded to Vercel Blob. Backgrounds shot on a phone arrive as 8–20 MB
 * 4000px+ JPEG/HEIC exports; the displays are 1080×1920 (or 1920×1080), so
 * anything beyond ~2560px is pure storage + egress waste. Downscaling and
 * re-encoding here keeps every stored blob within budget instead of relying
 * on people remembering to resize first.
 *
 * Rules:
 * - SVGs pass through untouched (vector, already tiny).
 * - Logos only get downscaled when oversized, keeping their original format
 *   (no lossy re-encode of crisp-edged artwork).
 * - Photos/backgrounds get capped at 2560px and re-encoded to WebP when
 *   they're oversized or heavier than ~1.5 MB.
 * - The optimized file is only used when it's actually smaller; any failure
 *   (odd codec, canvas limits) falls back to uploading the original.
 */

// 2560 covers both display orientations (1920 long edge) with headroom for
// the ken-burns 1.08 zoom without visible softening.
const PHOTO_MAX_DIM = 2560;
const LOGO_MAX_DIM = 1800;
const PHOTO_BYTE_THRESHOLD = 1.5 * 1024 * 1024;
const WEBP_QUALITY = 0.82;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
    default:
      return 'png';
  }
}

function renamed(filename: string, mime: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${base}.${extensionFor(mime)}`;
}

export async function optimizeImageFile(
  file: File,
  type: 'image' | 'logo',
): Promise<File> {
  if (file.type === 'image/svg+xml') return file;

  const isLogo = type === 'logo';
  const maxDim = isLogo ? LOGO_MAX_DIM : PHOTO_MAX_DIM;

  try {
    // createImageBitmap applies EXIF orientation, so phone photos come out
    // upright after the canvas round-trip.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const oversized = scale < 1;
    const heavy = !isLogo && file.size > PHOTO_BYTE_THRESHOLD;

    if (!oversized && !heavy) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // Logos keep their format (PNG stays lossless w/ alpha); photos go WebP.
    const targetMime = isLogo ? file.type : 'image/webp';
    const blob = await toBlob(
      canvas,
      targetMime,
      targetMime === 'image/png' ? undefined : WEBP_QUALITY,
    );
    if (!blob || blob.size >= file.size) return file;

    // canvas.toBlob falls back to PNG when the requested type is
    // unsupported — name the file after what we actually got.
    return new File([blob], renamed(file.name, blob.type), { type: blob.type });
  } catch {
    return file;
  }
}
