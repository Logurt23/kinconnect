# KinConnect: notes from the build session on Logan's PC

The hands-on side of the work done on Logan's Windows PC (`E:\Claude\KinConnect`, 2026-10-02 to 2026-10-17):
how the code was tested there, and the traps hit along the way with how each was solved. The chat-level
story is in [`SESSION-HISTORY.md`](SESSION-HISTORY.md); current state and open questions are in
[`../CONTEXT.md`](../CONTEXT.md).

## What this session did

| Request (from the project thread) | Result | Commit |
| --- | --- | --- |
| Move off Supabase to all Google Cloud | Cloud SQL + PostgREST sidecar, Identity Platform, Cloud Storage, polling for live updates, Cloud Run/Build/Scheduler deploy files and README | a388cb2 |
| "Compile an artifact so I can see it" | Screen tour of every page, phone and desktop, from the production build: https://claude.ai/artifact/7epyDmb98mkvu9MCX5AEFC | (no code) |
| Status board, SOS, storm mode, text-only vault with PIN section, 1 GB each | `db/02_status_and_vault.sql`, `StatusBoard`, storm mode on Home, vault rewrite | d4d11b5 |
| Quick polls sent to a family group | `db/03_polls.sql`, `/polls`, `PollCard`, "Polls waiting on you" on Home | 418d691 |
| Grocery list parents start and everyone adds to | `db/04_groceries.sql`, `/groceries`, open lists on Home | b729b65 |

Each feature landed with an end-to-end test (`e2e/status-vault.mjs`, `e2e/polls.mjs`, `e2e/groceries.mjs`)
and passed the full suite, lint, typecheck and production build before it was pushed.

## How the PC is set up for testing

The PC has no Docker, so `docker-compose.yml` (the documented way) couldn't be used here. Native stand-ins
live in `E:\Claude\kinconnect-devstack`, outside the repo, safe to delete:

| Service | Stand-in | Port |
| --- | --- | --- |
| Cloud SQL | Postgres 18 from the npm package `@embedded-postgres/windows-x64` (`pgdata/`, user `postgres`, password `postgres`) | 54322 |
| PostgREST sidecar | `postgrest.exe` v16.4 from GitHub releases; needs the Postgres `bin` folder on `PATH` for `libpq.dll` | 3001 |
| Identity Platform | Firebase Auth emulator (`npx firebase emulators:start --only auth --project demo-kinconnect`); pure Node, no Java needed | 9099 |
| Cloud Storage | `fake-gcs-server.exe` v1.56.1 with `-backend memory -data gcsseed` | 4443 |
| weather.gov + an ICS feed | `node e2e/stub-server.mjs` (in the repo) | 4555 |

Playwright uses the installed Chrome: `CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`.
`.env.local` (git-ignored) points the app at all of the above; `.env.example` shows the same values.

Order matters: start Postgres, **wait until it accepts connections**, then `npm run db:reset` (or
`db:migrate`), then PostgREST, then the app, then `bash e2e/run.sh`.

## Traps hit, and the fixes now in the code

- **`@google-cloud/storage` and `STORAGE_EMULATOR_HOST` disagree.** With that variable set, uploads go to
  `/upload/storage/v1/...` but reads go to `/b/...` without the `/storage/v1` prefix, so every read 404s.
  The app uses its own `GCS_ENDPOINT` setting and passes it as `apiEndpoint` instead (`src/lib/storage.ts`).
  Production sets neither.
- **fake-gcs-server's filesystem backend on Windows** stores nested names (`vault/<uid>/file`) but can't read
  them back. Use `-backend memory`.
- **The Auth emulator stamps `lastSignInTime` when an account is created**, so "never signed in" can't tell a
  pending invite. Canceling an invite instead checks whether the account has a password yet
  (`src/app/(app)/family/actions.ts`). The emulator also keeps a password-reset code working after its
  account is deleted, so `/auth/update-password` also requires a profile for that email.
- **RLS: a just-inserted row isn't visible to a `security definer` lookup function in the same statement.**
  An insert that returns the row (`.insert().select()`) fails if the table's SELECT policy calls such a
  function. Polls and grocery lists write their SELECT policy inline (`circle_ids && my_circle_ids()`),
  as alerts already did.
- **Locked vault files and the owner's own folder.** `/files` used to skip the database check for a member's
  own folder; that would have opened locked vault files without the PIN. Every read now goes through
  `can_read_object`.
- **Tailwind turns `_` into a space in arbitrary variants**, so `[&:has(#kind-yes_no:checked)...]` never
  matched. Ids used in such selectors have no underscores (`#kind-yesno`).
- **`back()` and `#anchors`.** The flash message was being added after the `#`; `src/lib/actions.ts` now puts
  the query before the anchor.
- **The `flash()` e2e helper can read Next's route announcer** (also `role="alert"`), which holds the page
  title. New tests wait for the exact message text instead.
- **Windows cleaned the session's Temp folder**, deleting downloaded `.exe` files and empty Postgres folders
  mid-session. That's why the stand-ins moved to `E:\Claude\kinconnect-devstack`.
- **Git Credential Manager** opens a GitHub sign-in window on the PC the first time a push runs; the push
  waits until Logan signs in.
- **Cloud Run sidecars:** whether a Cloud SQL socket is shared between containers isn't documented, so
  `deploy/service.yaml` runs the Cloud SQL Auth Proxy as a third container and PostgREST connects to
  `127.0.0.1:5432`. PostgREST's `/ready` listens on `0.0.0.0:3002` for the startup probe. `cloudbuild.yaml`
  copies the pinned PostgREST image into Artifact Registry.
- **`sed` placeholders:** `deploy/service.yaml` uses `__PROJECT__`, `__REGION__` and `__SITE__`, because a
  bare `PROJECT` would also rewrite `GOOGLE_CLOUD_PROJECT`.

## Database files, in order

| File | Adds |
| --- | --- |
| `db/00_platform.sql` | Roles PostgREST switches between (`anon`, `authenticated`, `service_role`, `authenticator`) and `auth.uid()` |
| `db/01_kinconnect.sql` | The original schema and RLS, created as `service_role` (which owns the tables, so RLS doesn't apply to it) |
| `db/02_status_and_vault.sql` | Member status and watch lists; vault text-only rule, locked items, PIN table, 1 GB trigger |
| `db/03_polls.sql` | Polls, options, votes |
| `db/04_groceries.sql` | Grocery lists and items |

`npm run db:migrate` applies each file once and records it in `migrations.applied`; re-running is safe.
`live_stamp()` is redefined by each later file so live refresh covers its tables.
