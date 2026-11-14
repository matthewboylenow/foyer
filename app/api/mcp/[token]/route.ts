import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { getCurrentTenant } from '@/lib/tenant';
import { registerFoyerTools } from '@/lib/mcp/tools';
import { tokenMatches } from '@/lib/mcp/token';

/**
 * MCP server for managing screen slides from a chat client.
 *
 *   https://foyer.sainthelen.org/api/mcp/<FOYER_MCP_TOKEN>
 *
 * The token in the path is the whole authentication: anything else is a
 * 404 before the database is touched. Streamable HTTP, stateless, served
 * straight from the official SDK (`@modelcontextprotocol/server`); the
 * `mcp-handler` wrapper was not used because its types add `auth` to the
 * global Request, which breaks the Auth.js middleware signature. The
 * tenant comes from the request host like every other route (middleware
 * sets x-tenant-slug, getCurrentTenant reads it). Tools live in
 * lib/mcp/tools.ts and share lib/ingest.ts with POST /api/ingest.
 *
 * See README-mcp.md for connecting a client and rotating the token.
 */

// read_email waits on Claude for up to ~90s.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };

async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!tokenMatches(token, process.env.FOYER_MCP_TOKEN)) {
    return new Response('Not found', { status: 404, headers: NOINDEX });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return new Response('No tenant for this host', { status: 500, headers: NOINDEX });

  // One server per request (the SDK's stateless mode); the tools close over
  // the tenant resolved for this host.
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: 'foyer', version: '1.0.0' });
      registerFoyerTools(server, { tenant, actor: 'mcp' });
      return server;
    },
    {
      legacy: 'stateless',
      onerror: (err) => console.error('[mcp]', err),
    },
  );

  try {
    const res = await handler.fetch(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(NOINDEX)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } finally {
    void handler.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
