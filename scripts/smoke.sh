#!/usr/bin/env bash
# Build output must exist (pnpm build). Starts the app with a database that
# cannot answer (so the player page's no-database path is what gets tested),
# runs the browser smoke test against it, and shuts it down.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${SMOKE_PORT:-3999}"
export DATABASE_URL="${SMOKE_DATABASE_URL:-postgresql://smoke:smoke@127.0.0.1:9/smoke}"
export AUTH_SECRET="${AUTH_SECRET:-smoke-only-not-a-real-secret-0000000000}"
export AUTH_URL="http://localhost:$PORT"
export AUTH_DEV_BYPASS=0
export NEXT_TELEMETRY_DISABLED=1
node_modules/.bin/next start -p "$PORT" > /tmp/foyer-smoke-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:$PORT/api/health" 2>/dev/null || grep -q "Ready" /tmp/foyer-smoke-server.log 2>/dev/null; then break; fi
  sleep 1
done
BASE_URL="http://localhost:$PORT" node scripts/smoke-player.mjs
