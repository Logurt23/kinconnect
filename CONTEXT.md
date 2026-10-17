# KinConnect: project context

Read this first when picking the project up in a fresh chat. It records what the code alone doesn't:
decisions, open questions and where things stand. Last updated 2026-10-17.

## What it is

A private, invite-only family web app for Logan (GitHub `Logurt23`). One URL, a dashboard, and screens for
Home, Alerts, Resources, Requests, Polls, Schedule, Dates, Lists, Groceries, Ledger, Weather, Vault, Family
and Settings. Members belong to circles (Core, Extended, plus any branches); what each person sees is
decided by circle overlap in the database's row-level security, not in the UI.

Ground rules from the original brief: no real 911 calls (the SOS and 911 buttons tell the family and say
plainly that they don't call 911), no payments (the ledger only records who owes whom), no social media
scraping.

## How Logan wants Claude to work

- Don't prompt him. Pick sensible defaults, say which one you picked, and keep going.
- The name is **KinConnect** ("Kinroot" was the brief's working title, now retired).
- Design is mobile-first, with its own look: teal brand, bottom tab bar on phones, sidebar on desktop.
  Don't copy the Four States Mothership portal's styling.
- He runs his infrastructure on Google Cloud, so everything targets GCP.

## Where the code is

- Repo: https://github.com/Logurt23/kinconnect. `main` is an empty initial commit.
- All work is on branch `claude/kinroot-app`, in **draft PR #1**: https://github.com/Logurt23/kinconnect/pull/1
- Logan's working copy is on his Windows PC at `E:\Claude\KinConnect`. The local stand-in services used for
  tests live in `E:\Claude\kinconnect-devstack`, outside the repo.
- Secrets live only in `.env.local` (git-ignored) and, in production, in Secret Manager. Never commit them.
- A click-through screen tour of every page: https://claude.ai/artifact/7epyDmb98mkvu9MCX5AEFC

## Stack (all Google Cloud)

| Piece | Service |
| --- | --- |
| App | Next.js 16 App Router + React 19 + TypeScript + Tailwind 4, on Cloud Run |
| Database | Cloud SQL Postgres. Schema and RLS are in `db/*.sql`, applied by `npm run db:migrate` |
| Data API | PostgREST as a Cloud Run sidecar. The app signs a short JWT per request (`role: authenticated`, `sub`: the member id), so `auth.uid()` and every policy apply. Admin work uses `service_role`. Code uses `@supabase/postgrest-js`. |
| Sign-in | Identity Platform (firebase-admin + REST). Server-side password check, then an httpOnly session cookie. Invites and password resets both use the "password reset" email, which lands on `/auth/action`. Self sign-up must be off. |
| Files | One private Cloud Storage bucket, served through `/files/...` after an access check as the member. No public or signed links. |
| Live updates | Pages poll `/api/live` every 10 seconds |
| Sweeps | Cloud Scheduler calls `/api/cron/weather` (every 15 min) and `/api/cron/calendars` (hourly) with `Authorization: Bearer $CRON_SECRET` |
| Weather | National Weather Service API (`api.weather.gov`) |
| Calendars | Google Calendar (read-only OAuth, refresh tokens AES-256-GCM encrypted) and Apple/other subscribe links (ICS) |

The app moved off Supabase on 2026-10-02 because Logan chose "All GCP". The `@supabase/postgrest-js`
package is only the PostgREST client; nothing talks to Supabase.

## What's built (all on PR #1)

- Invite-only sign-in, password reset, admin invites with pending list and cancel, deactivate/reactivate.
- Alerts: notices, family emergency, 911-style emergency (tells the family, never calls 911), weather
  check-ins, updates, read receipts, unread badge.
- Resources (loan, sell or give, with photos and reservations), Requests (claim and finish), Dates and
  milestones, gift Lists (the owner never sees claims), Ledger (both people tick "paid").
- Schedule: Google and Apple calendars, manual blocks, busy-only by default.
- Weather: NWS alerts at each member's home base, with check-in prompts for Severe or Extreme alerts.
- **Family status board** (opt-in in Settings): Safe (green), Still exploring (orange), Away, Out of town,
  On vacation, In the hospital, Incarcerated, SOS. One-tap statuses on Home. SOS asks for confirmation and
  alerts the family's circles. Each person picks whose status they see (Core if they pick nobody).
- **Storm mode:** during a tornado watch or warning, or while a weather check-in is open, Home shows
  check-ins, status and weather first.
- **Vault:** text files only (.txt, .md, .csv, .json and similar, judged by contents), 1 GB per person.
  The PIN-locked section stays open 15 minutes and locks for 15 minutes after five wrong tries. Locked
  files can't be shared and stay hidden by RLS until the PIN is entered.
- **Polls:** yes/no or pick one of up to six options, optional write-ins, sent to chosen circles, live
  results, optional auto-close.
- **Groceries:** shared lists for chosen circles. Everyone adds items from their own account (amount, note,
  who asked). The shopper ticks items into "In the cart", live on everyone's screen. The list owner can
  clear, close or delete it.
- Hardening: CSP and security headers, SSRF-safe calendar fetching, upload type sniffing, a reservation
  guard trigger, timing-safe cron auth. The report is in the project files (`kinroot/hardening-report.md`).

## Run and test locally

See "Run locally" in `README.md`. In short: Node 22, `docker compose up -d` (Postgres, PostgREST,
fake-gcs-server), the Firebase Auth emulator (`npx firebase-tools emulators:start --only auth --project
demo-kinconnect`), then `npm run db:migrate`, `npm run bootstrap-admin` and `npm run dev`.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, and `e2e/run.sh` (a Playwright browser suite
against a fresh local stack; it wipes the local data). The header of `e2e/run.sh` lists what must be
running. `e2e/tour.mjs` takes phone and desktop screenshots of every screen.

## Deploy (not done yet)

Follow "Deploy on Google Cloud" in `README.md`, in order: service account, Cloud SQL, Identity Platform
(turn off self sign-up, point the email's action link at `/auth/action`), Cloud Storage, Secret Manager,
Cloud Build and Cloud Run (`deploy/service.yaml`: the app plus PostgREST and the Cloud SQL connector),
Cloud Scheduler, then `npm run bootstrap-admin` for the first admin. Google Calendar's OAuth client is
optional.

**Run `npm run db:migrate` against Cloud SQL on every deploy.** It applies the new `db/` files (status and
vault, polls, groceries).

What Logan must supply: a GCP project, and optionally a Google OAuth client for Calendar.

## Open questions for Logan (defaults in place)

1. **PDFs in the vault?** He said text files only, so PDFs are refused for now.
2. **Tap to mark Safe?** Statuses are set by tapping. A website can't track location in the background;
   automatic "got home" would need a phone app.
3. **Admin-only grocery lists?** He said "the mom or dad" starts a list, but the app has no parent role, so
   anyone can start one. It could be limited to admins.

## Known gaps

- It has never run on real Google Cloud. Everything was tested against local stand-ins (Firebase Auth
  emulator, fake-gcs-server, Docker Postgres and PostgREST), so expect small fixes on the first deploy:
  Cloud Run sidecars, Identity Platform's real email links, Cloud SQL connectivity.
- Google Calendar OAuth has never been tested against real Google.
- GitHub runs no CI on the PR; all checks run locally.
- The calendar-link guard checks the address before fetching, so DNS rebinding between the check and the
  connection is still theoretically possible (accepted for a family app).
- Live updates are polling (10 s), not push.

## Likely next

1. Answer the three open questions and adjust the defaults.
2. First real deploy to GCP following the README, then fix whatever it turns up.
3. Invite the family, then mark PR #1 ready and merge it into `main`.
