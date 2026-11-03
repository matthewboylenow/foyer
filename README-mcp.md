# Foyer MCP server

Lets a chat client (Claude, or anything that speaks MCP over Streamable
HTTP) read and manage the parish screens: list slides, add or update
announcements, turn slides on and off, publish, and check whether the TVs
are up.

## Connecting

Connector URL (the token **is** the password; treat the URL as a secret):

```
https://foyer.sainthelen.org/api/mcp/<FOYER_MCP_TOKEN>
```

In Claude: Settings → Connectors → Add custom connector → paste the URL.
No OAuth, no extra headers. A wrong or missing token gets a plain 404, and
the endpoint is marked `noindex`.

Tenant is resolved from the host, so the same code serves any Foyer tenant
at its own domain.

## Tools

| Tool | What it does |
|---|---|
| `list_slides({ status?, source? })` | Slides with full text. `status`: `active` (default), `inactive`, `all`. `source`: e.g. `chat`, `comms-portal`, or `admin` for slides made by hand. |
| `get_slide({ id })` | One full row, content JSON included. |
| `upsert_slides({ source, slides[], prune?, publish? })` | Create or update by your own ids. `prune` turns off slides from that source missing from the payload (never deletes). |
| `set_slide_active({ id, active, publish? })` | Turn any slide on or off, admin-made ones included. |
| `publish_screens()` | Push the current "on" set to the TVs (same as the admin button). |
| `get_screen_status()` | Counts, staged-but-unpublished changes, each TV online/offline, last ingest/MCP activity, and the templates with their fields. |

Everything written is **staged** until published, exactly like edits in the
admin. Pass `publish: true` or call `publish_screens`. Every write leaves an
audit row (`mcp:<tool>`) visible under Admin → Activity.

### Slide fields (`upsert_slides`)

- `sourceId`: your stable id. Same id again updates that slide.
- `title`: internal name for the admin grid.
- `templateType`: `general` (default) or `welcome_quote`.
- `content.headline`: the big line. Under about 50 characters, 7 words or
  fewer; always renders at the small size.
- `content.meta`: one line of when and where.
- `content.body`: the announcement as written. Plain text; blank line
  between paragraphs; `- ` bullets; `**bold**`. Escaped on the way in, so
  no HTML comes through from callers.
- `content.cta` / `content.ctaUrl`: closing sentence on its own bold line;
  the URL becomes a QR code.
- `startAt` / `endAt`: ISO 8601 with offset. `endAt` should be the event
  start time. Either may be omitted.
- `weight` (0 to 3) and `active`.

Slides from a source land in a collection named `From <source>` so they can
be filtered in the Slides grid. Pins, takeover, per-TV targeting and
duration set in the admin survive resyncs.

## Plain HTTP ingest

The same contract is available without MCP:

```
POST https://foyer.sainthelen.org/api/ingest
Authorization: Bearer <FOYER_INGEST_TOKEN, or FOYER_MCP_TOKEN if unset>
Content-Type: application/json

{ "source": "comms-portal", "prune": true, "publish": false,
  "slides": [ { "sourceId": "req_123", "title": "Saint Helen Fest",
    "content": { "headline": "Saint Helen Fest",
                 "meta": "Saturday, November 8 · 5:00 PM · Meaney Hall",
                 "body": "Join us for food and music.\n\nBring the whole family!",
                 "cta": "To sign up, visit sainthelen.org/fest.",
                 "ctaUrl": "https://sainthelen.org/fest" },
    "endAt": "2026-11-08T17:00:00-05:00" } ] }
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `FOYER_MCP_TOKEN` | Vercel (production) | Path token for `/api/mcp/<token>`; also the bearer token for `/api/ingest` unless the next one is set. At least 32 random bytes. |
| `FOYER_INGEST_TOKEN` | Vercel (optional) | Separate bearer token for `/api/ingest`, if the comms portal should not hold the MCP token. |

Unset token means the route refuses everything (404), never open access.

## Rotating the token

1. Make a new one: `openssl rand -hex 32`.
2. Vercel → foyer → Settings → Environment Variables → edit
   `FOYER_MCP_TOKEN` (production). Redeploy (any push, or "Redeploy" on the
   latest deployment); the old URL stops working the moment the new build
   is live.
3. Update the connector URL in every client that had the old one.
4. If `/api/ingest` callers use the same token, update them too, or give
   them their own `FOYER_INGEST_TOKEN`.

## Local testing

```
FOYER_MCP_TOKEN=devtoken-devtoken-devtoken AUTH_DEV_BYPASS=1 pnpm dev
npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp/devtoken-devtoken-devtoken --transport http --method tools/list
```

Schema: `slides.source_id` (migration `0012_ingest_source_id`), unique per
tenant where set, written as `<source>:<sourceId>`.
