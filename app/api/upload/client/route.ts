import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/lib/auth/config';

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

// Max sizes in bytes. Video gets 100 MB because client uploads bypass the
// 4.5 MB serverless body limit that previously capped us at 25 MB.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * Client-upload helper for Vercel Blob. The browser POSTs here to request a
 * short-lived upload token, then uploads directly to Blob storage — the
 * file never passes through our serverless function. After upload, the
 * client POSTs to /api/media to register the row in our DB.
 *
 * See: https://vercel.com/docs/vercel-blob/using-blob-sdk#client-uploads
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? (JSON.parse(clientPayload) as { type?: string }) : {};
        const isVideo = payload.type === 'video';
        return {
          allowedContentTypes: isVideo ? ALLOWED_VIDEO : ALLOWED_IMAGE,
          maximumSizeInBytes: isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // We register the media row from the client (POST /api/media) right
        // after upload() resolves — simpler than relying on this webhook,
        // which doesn't fire in local dev anyway.
      },
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload token failed';
    return Response.json({ error: message }, { status: 400 });
  }
}
