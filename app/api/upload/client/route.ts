import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

// Cap videos at 15 MB to control Vercel Blob egress — a 1080p 10s loop
// re-encoded to ~3–6 Mbps fits comfortably and looks identical at TV
// viewing distance vs. the prior 100 MB ceiling.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

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

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? (JSON.parse(clientPayload) as { type?: string }) : {};
        const isVideo = payload.type === 'video';

        // Refuse to mint a token for a path that isn't inside the
        // requesting tenant's folder. The client should be sending
        // "<slug>/<filename>" — if it isn't, either the slug provider
        // didn't hydrate or someone is trying to cross-tenant write.
        if (!pathname.startsWith(`${tenant.slug}/`)) {
          throw new Error(
            `Upload path must live under "${tenant.slug}/" (got "${pathname}")`,
          );
        }

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
