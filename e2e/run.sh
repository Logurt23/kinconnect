#!/usr/bin/env bash
# End-to-end run against a fresh local stack. Needs, with .env.local pointing at them: Postgres, PostgREST on
# :3001, the Firebase Auth emulator on :9099 (project demo-kinconnect) and fake-gcs-server on :4443 (see
# "Run locally" in the README); the app on :3000 started with NWS_BASE_URL=http://127.0.0.1:4555 (and
# `next dev` for the schedule test, which uses an http feed); and `node e2e/stub-server.mjs` running.
# Wipes the local database and the emulator's accounts.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p e2e/out
curl -s -X POST http://127.0.0.1:4443/storage/v1/b -H "Content-Type: application/json" -d '{"name":"kinconnect-files"}' >/dev/null
curl -s -X DELETE http://127.0.0.1:9099/emulator/v1/projects/demo-kinconnect/accounts >/dev/null
npm run -s db:reset >/dev/null && npm run -s bootstrap-admin
for t in family alerts resources mid weather-vault schedule misc hardening live status-vault; do
  echo "=== $t"
  node "e2e/$t.mjs"
done
