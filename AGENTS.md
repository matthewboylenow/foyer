<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Foyer: working rules

Foyer runs the lobby TVs at Saint Helen. A bad deploy is visible on a wall
within minutes, so the bar is: nothing reaches `release` that has not run
in a real browser.

## Before every push to main

Run `pnpm verify` (type-check, lint, unit tests, production build, and the
player smoke test in Chromium). CI runs the same and only then
fast-forwards `release`, which is Vercel's production branch. If `verify`
is red, do not push.

The smoke test (`scripts/smoke-player.mjs`) boots `/display/<id>` with a
mocked playlist against a database that cannot answer, and fails on any
page error, console error, error report, missing video, or a player that
does not advance. Any change to `components/player/*`, the templates, the
display page or `middleware.ts` must keep it green; extend the fixture when
you add a template or a media path.

## What the player must survive

- Database down: `TenantTheme` falls back to brand defaults; the player
  runs on its cached playlist (localStorage).
- A broken slide: `SlideErrorBoundary` bans it for the session.
- A crash above the slide: `PlayerBoundary` shows the parish name, reports
  once and reloads with backoff. Never let the Next.js "Application error"
  page reach a TV.
- Media: everything permanent lives in `public/media` (CDN, included
  transfer). Blob is for one-off uploads only.

## Cost rules

- Players heartbeat once a minute by day and every ten minutes in quiet
  hours (`QUIET_HOURS`, default 23-6 Eastern); the cron does nothing in
  quiet hours so Neon can sleep. Do not add polling to the player.
- `computePlaylistVersion` is cached 20 s per instance; publish
  invalidates it. Keep heartbeat and playlist routes to one query each.
- No new background jobs without a reason written in the cron file.

## Conventions

- Edits are staged; `publishPlaylist` is the only way content reaches a
  TV. Every write path (admin, MCP, ingest) audits with a clear action
  name and never deletes slides.
- Secrets only in Vercel env; never in code, logs, tests or docs.
- Server-to-server routes (`/api/mcp`, `/api/ingest`, `/api/cron`,
  `/api/health`) are exempt from the session gate in `middleware.ts` and
  carry their own auth or none by design. Say which in the route comment.
- Routes under `app/display/*` and `app/api/display/*` are public (the TVs
  have no session). Treat their inputs as hostile.
