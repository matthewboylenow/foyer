/**
 * Captures a still frame from a local video file in the browser, before the
 * file is uploaded. Because the source is a local object URL, this costs
 * zero network — the poster exists so admin surfaces (slide cards, the
 * editor preview, Now Playing) never have to mount a <video> that streams
 * the real file from Blob storage just to show what it looks like.
 */

const POSTER_MAX_WIDTH = 1280;
const POSTER_QUALITY = 0.8;
const CAPTURE_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('poster capture timed out')), CAPTURE_TIMEOUT_MS),
    ),
  ]);
}

export async function captureVideoPoster(file: File): Promise<Blob | null> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('video failed to load'));
      }),
    );

    // Grab a frame slightly in — loop videos often fade in from black, so
    // frame zero would make a useless poster.
    const target = Math.min(0.5, (video.duration || 2) / 4);
    if (Math.abs(video.currentTime - target) > 0.01) {
      await withTimeout(
        new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.currentTime = target;
        }),
      );
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, POSTER_MAX_WIDTH / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', POSTER_QUALITY),
    );
  } catch {
    // Odd codec, decode failure, timeout — the upload proceeds without a
    // poster; previews fall back to a metadata-only <video>.
    return null;
  } finally {
    video.removeAttribute('src');
    URL.revokeObjectURL(objectUrl);
  }
}
