import { getCurrentTenant } from '@/lib/tenant';
import { IngestError, IngestRequestSchema, upsertSlides } from '@/lib/ingest';
import { bearerToken, tokenMatches } from '@/lib/mcp/token';

export const maxDuration = 60;

/**
 * POST /api/ingest   Authorization: Bearer <FOYER_INGEST_TOKEN or FOYER_MCP_TOKEN>
 *
 * Server-to-server upsert of source-owned slides. Same contract as the MCP
 * `upsert_slides` tool (lib/ingest.ts IngestRequestSchema). Exempt from the
 * session gate in middleware.ts; the bearer token is the only auth.
 */
export async function POST(req: Request) {
  const expected = process.env.FOYER_INGEST_TOKEN || process.env.FOYER_MCP_TOKEN;
  if (!tokenMatches(bearerToken(req), expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'X-Robots-Tag': 'noindex' } });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 500 });

  const json = await req.json().catch(() => null);
  const parsed = IngestRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) },
      { status: 400 },
    );
  }

  try {
    const result = await upsertSlides(tenant.id, parsed.data, `ingest:${parsed.data.source}`, 'ingest:upsert');
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  } catch (err) {
    if (err instanceof IngestError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[ingest]', err);
    return Response.json({ error: 'Ingest failed' }, { status: 500 });
  }
}
