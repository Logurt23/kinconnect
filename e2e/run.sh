#!/usr/bin/env bash
# End-to-end run against a fresh local database. Needs: `npm run db:start`, the app on :3000 started with
# NWS_BASE_URL=http://127.0.0.1:4555 (and `next dev` for the schedule test, which uses an http feed),
# and `node e2e/stub-server.mjs` running. Wipes the local database.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p e2e/out
npx supabase db reset >/dev/null && npm run -s bootstrap-admin
curl -s -X DELETE http://127.0.0.1:54324/api/v1/messages >/dev/null
for t in family alerts resources mid weather-vault schedule misc hardening; do
  echo "=== $t"
  node "e2e/$t.mjs"
done
