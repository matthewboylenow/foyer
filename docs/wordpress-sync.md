# WordPress → Foyer sync: implementation note and contract

Branch: `claude/wordpress-sync`. Nothing here is deployed; migration 0012 has
not been run anywhere.

## 1. How Foyer stages and publishes screen content today

- Slides live in `slides`. Edits in the admin (editor, grid toggles, drag
  order, email import) write to `slides` directly but are **staged**.
- "Publish to screens" (`POST /api/publish`, `lib/publish.ts
  publishPlaylist`) copies every *active* slide into one
  `playlist_snapshots` row (full rows, dates as ISO strings). The last 20
  snapshots are kept. Takeover saves and the email import can publish
  automatically; everything else waits for the button.
- The player (`app/api/display/[displayId]`, `lib/db/queries.ts
  getEligibleSlides`) serves the **latest snapshot** when one exists, else the
  live rows (pre-v23 behavior, only before the first publish). Schedule
  dates, display targeting, orientation availability and the takeover filter
  are applied at serve time, so dated slides fall off on their own.

The brief's warning is correct: `publishPlaylist` snapshots every active
slide. Using it from a sync would push unrelated staged edits live. The sync
below never calls it.

## 2. Eligibility and version

`getEligibleSlides`: active + within `startAt/endAt` (if dated) + not
excluded by `targetDisplays` + has content for the display's orientation;
if any eligible slide has `priority`, only priority slides remain.

`computePlaylistVersion` (`lib/fleet.ts`) is one SQL statement:
`md5(snapshotTerm | orientation | active | settings.updatedAt | sourceTerm)`
where `snapshotTerm` = latest snapshot id + the ids of its slides inside their
dates right now (or, with no snapshot, `id:updatedAt` of the live eligible
rows). The heartbeat (`POST .../heartbeat`, once a minute) returns this
version; the player refetches the playlist when it changes, and the playlist
route answers `If-None-Match` with 304. Anything that must reach the screens
has to move this hash.

## 3. Chosen design: a dedicated source-managed layer

Two options were compared.

**A. Source columns on `slides`** (`source`, `sourceId`, `revision`, …).
Pros: the admin grid, collections, pins, snapshots and templates work with no
serving changes. Cons: WordPress items would be subject to staging, so a
WordPress update either waits for a human publish (defeats the purpose) or
calls the global publish (pushes unrelated staged edits live, which the brief
forbids). Mixing source-owned and Foyer-owned columns in one row also makes
"a resync must not change Foyer-authored slides" a convention rather than a
structural guarantee.

**B. `source_items` table (chosen).** Editorial columns (title, content,
schedule, status, revision, hash) are written only by the sync; presentation
columns (`hidden`, `weight`, `durationOverrideSec`, `pin`, `targetDisplays`)
are written only by the admin and survive every resync. Items are merged into
the player's eligible set at serve time as slide-shaped rows and join the
version hash through their own term. They bypass staging by design: the
source already approved them. Foyer slides are never read or written by the
sync, and a snapshot never contains source items.

Tradeoff: source items don't appear in the Slides grid or in collections, and
the "Now playing" thumbnail on the Displays page can't resolve a source item
by id yet (it looks up `slides`). They have their own admin page instead
(`/admin/sources`). Both are acceptable for a first integration and easy to
extend.

Template contract is unchanged: items render through the existing `general`
and `poster` templates with `GeneralContent` / `PosterContent` shapes built
server-side from the delivered fields. HTML in delivered text is escaped.
Poster images are public https URLs rendered by the Poster template's plain
`<img>`; background images (which go through `next/image` and its host
allow-list) are intentionally not supported for source items.

## 4. Preview/test setup

- Vitest (jsdom) runs `lib/**/__tests__`. No database in tests.
- Vercel builds preview deployments for every branch, and **the project's
  `DATABASE_URL` is targeted at both production and preview**, so a preview
  deployment uses the production database. There is **no isolated preview
  database**. A preview of this branch would also fail at runtime on the new
  tables until migration 0012 is applied. Testing against a real database
  needs a Neon branch (or a second Neon project) with `DATABASE_URL` set for
  the preview environment only; until then, the route is covered by the
  mocked tests in `lib/sources/__tests__/route.test.ts` and the pure logic
  tests in `wordpress.test.ts`.

## Contract: `POST /api/sources/wordpress`

Server-to-server only. Exempt from the session gate in `middleware.ts`;
authentication is the signature below and nothing else.

### Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Foyer-Timestamp` | Unix seconds at send time. Rejected if more than 5 minutes from the server clock. |
| `X-Foyer-Signature` | `sha256=` + hex HMAC-SHA256 of `"${timestamp}.${rawBody}"` with the shared secret. |
| `X-Foyer-Delivery` | Optional opaque id for the sender's retry bookkeeping; echoed back and logged. |

The secret is `WORDPRESS_SYNC_SECRET` in Foyer's server environment (not set
yet). Sign the exact bytes you send; do not re-serialize.

### Body

```json
{
  "source": "wordpress",
  "tenant": "saint-helen",
  "deliveryId": "optional",
  "items": [
    {
      "sourceId": "1234",
      "revision": 1760000000,
      "status": "active",
      "kind": "announcement",
      "title": "Saint Helen Fest",
      "heading": "Saint Helen Fest",
      "subtitle": "Saturday, October 18 · 5:00 PM · Meaney Hall",
      "paragraphs": ["Join us for an afternoon of food and music."],
      "cta": "To sign up, visit sainthelen.org/fest.",
      "ctaUrl": "https://sainthelen.org/fest",
      "eventDate": "2026-10-18",
      "startAt": "2026-10-01T04:00:00-04:00",
      "endAt": "2026-10-19T10:00:00-04:00",
      "sourceUrl": "https://sainthelen.org/wp-admin/post.php?post=1234&action=edit",
      "sourceUpdatedAt": "2026-10-09T15:12:00-04:00"
    }
  ]
}
```

Rules:

- `tenant` must equal the slug of the tenant resolved from the request host
  (for `foyer.sainthelen.org` that is `saint-helen`). Mismatch → 403 for the
  whole delivery.
- `sourceId` is the WordPress post ID as a string; `(tenant, "wordpress",
  sourceId)` is unique. `revision` must not decrease; use the post's modified
  time as epoch seconds. A lower revision than stored is ignored (`stale`).
- `status`: `active` plays (subject to `startAt`/`endAt`); `withdrawn` stops
  playback and keeps the row. Send `withdrawn` when an item is unpublished,
  unmarked for signage, trashed, or its approval is revoked.
- `kind`: `announcement` or `event` render with the General template;
  `poster` renders the `imageUrl` full-screen with the Poster template (falls
  back to General if no image).
- `paragraphs` are plain text, one `<p>` each; HTML is escaped. `cta` is
  rendered on its own line in bold; `ctaUrl` becomes a QR code.
- Links must be `https`. Unknown fields are rejected (`strict`). Max 50 items
  and 512 KB per delivery; no duplicate `sourceId` within a delivery.
- Nothing in the payload can reference Foyer slides, media, or other
  tenants; draft/private content should simply not be sent.

### Response

`200`:

```json
{
  "ok": true,
  "tenant": "saint-helen",
  "deliveryId": "optional",
  "results": [{ "sourceId": "1234", "revision": 1760000000, "action": "created" }],
  "summary": { "created": 1 }
}
```

`action` ∈ `created | updated | unchanged | stale | withdrawn`. Retrying the
same delivery yields `unchanged` for every item. Items are processed in
order; on an unexpected error mid-way the response is `500` and retrying is
safe (already-written items come back `unchanged`).

Errors: `401` bad/missing signature or stale timestamp, `400` invalid JSON
or payload (with `issues[]`), `403` tenant mismatch, `413` too large, `503`
secret not configured. Every attempt, including rejected ones, is recorded
in `source_deliveries` (outcome, counts, error text; never the body or the
secret).

### After delivery

Active items inside their dates are on every eligible screen within a
minute (next heartbeat). They appear under **Admin → From WordPress** with
hide / how often / seconds controls (`PATCH /api/sources/items/[id]`, admin
session, tenant-scoped). Those controls are Foyer's and survive resyncs.

## Not done on purpose

- No OptiSigns integration, no video reels, no WordPress plugin changes.
- No pull-based fetch: an inbound signed endpoint is the smaller surface
  (no stored WordPress credentials in Foyer) and matches a plugin that fires
  on publish/update. A nightly reconciliation pull could be added later if
  deliveries prove unreliable.
- `displays.currentSlideId` for a source item resolves to nothing on the
  Displays page thumbnail; cosmetic.

## To go live (not done on this branch)

1. Apply migration 0012 (`drizzle/migrations/0012_v24_source_items.sql`,
   additive) to the production database.
2. Set `WORDPRESS_SYNC_SECRET` on the Vercel project (production) and give the
   same value to the WordPress plugin.
3. Merge and deploy.
4. WordPress plugin: build the adapter to this contract, send `withdrawn` on
   unpublish/unmark, retry with the same `revision` on failure.
