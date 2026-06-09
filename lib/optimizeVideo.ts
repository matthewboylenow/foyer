/**
 * Client-side video re-encoding, run in the browser before upload — the
 * video counterpart to lib/optimizeImage.ts. Uses WebCodecs (hardware
 * encoders) via mediabunny, so a raw phone clip gets normalized to signage
 * spec without a transcoding service or a server:
 *
 * - downscaled to a 1920px long edge (the displays' native resolution)
 * - re-encoded to H.264 MP4 at ~5 Mbps
 * - audio track stripped entirely (signage always plays muted)
 *
 * Files already within budget (≤ SKIP_BYTES) are passed through untouched.
 * Any failure — no WebCodecs (older Safari), undecodable codec, odd
 * container — falls back to the original file, which the existing 15 MB
 * cap then accepts or rejects as before.
 *
 * mediabunny is dynamically imported so the editor bundle doesn't carry it
 * until a video is actually selected.
 */

const SKIP_BYTES = 8 * 1024 * 1024;
const MAX_LONG_EDGE = 1920;
const TARGET_BITRATE = 5_000_000; // ~5 Mbps ≈ 6 MB for a 10s loop

// H.264 requires even dimensions.
const even = (n: number) => Math.max(2, 2 * Math.round(n / 2));

export async function optimizeVideoFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (file.size <= SKIP_BYTES) return file;
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    return file; // no WebCodecs — upload as-is, server cap still applies
  }

  try {
    const {
      Input,
      Output,
      Conversion,
      BlobSource,
      BufferTarget,
      Mp4OutputFormat,
      ALL_FORMATS,
      getFirstEncodableVideoCodec,
    } = await import('mediabunny');

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return file;

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(track.displayWidth, track.displayHeight));
    const width = even(track.displayWidth * scale);
    const height = even(track.displayHeight * scale);

    const codec = await getFirstEncodableVideoCodec(['avc'], { width, height });
    if (!codec) return file;

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: { codec, width, height, fit: 'fill', bitrate: TARGET_BITRATE },
      audio: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) return file;

    if (onProgress) {
      conversion.onProgress = (progress) => onProgress(Math.round(progress * 100));
    }
    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '')}.mp4`;
    return new File([buffer], name, { type: 'video/mp4' });
  } catch {
    return file;
  }
}
