# KinConnect: project context

Read this first when picking the project up in a fresh chat. It records what the code alone doesn't:
decisions, open questions and where things stand. Last updated 2026-10-21. The latest status report is
[`docs/REPORT-2026-10-20.md`](docs/REPORT-2026-10-20.md). For how the project got here,
chat by chat, see [`docs/SESSION-HISTORY.md`](docs/SESSION-HISTORY.md). For the local test setup on Logan's
PC and the traps already solved (emulator quirks, RLS, Windows), see
[`docs/PC-SESSION-NOTES.md`](docs/PC-SESSION-NOTES.md).

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
- The interactive prototype of the next round of features is `docs/preview/index.html` (open it in a browser; it is one
  self-contained file). It is also published at https://claude.ai/artifact/Au6JaVUBmuqC5QyewxzWsV. See
  "Prototype features not yet in the app" below.

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
- GitHub Actions CI (`.github/workflows/ci.yml`, added 2026-10-17): lint, typecheck and build on every push.
- Hardening: CSP and security headers, SSRF-safe calendar fetching, upload type sniffing, a reservation
  guard trigger, timing-safe cron auth. The report is in the project files (`kinroot/hardening-report.md`).

## Prototype features not yet in the app (designed 2026-10-19 to 10-21)

Everything in this section exists only in `docs/preview/index.html`, built and tested in chat with Logan. None of it is in
the Next.js app yet. It is the spec for the next build: port it screen by screen, with RLS for every new table.

- **Viewing as.** The prototype switches between Logan (parent/admin), Ava (kid, 9) and June (grandparent, simple mode).
  Names are shown from the viewer's side (Ava sees "Mom" and "Dad").
- **Family emergency tiers.** Yellow "Family emergency" button next to SOS. Low / Medium / High, pick circles or people.
  High adds the Emergency contacts circle. Receivers tap "I'm on it"; sender sees "seen by" and can close it.
  Optional live location until closed (SOS always shares it). Text-message backup to anyone who hasn't seen it in 5 min.
- **Enigma** (family messaging, app-wide): 1:1 and group chats, photos and voice messages that delete after 24 hours,
  reactions, read receipts, "Message" buttons on resources, requests, alerts and status tiles.
  **Logan chose the label "End-to-end encrypted"; real E2E encryption has to ship before this goes live.**
- **Circles:** templates (Household, Siblings, In-laws, Cousins, Close friends, Emergency contacts), color, edit, delete.
- **Groceries:** collapsible lists, "I'm shopping now", meal planner, recipe box that feeds the planner.
- **Kid accounts** (parents set them in Settings): kids don't see Carpool, Requests, Resources, Upkeep, Ledger or Vault.
  Kid-specific look and home: points, chores with "I did it!", routines, pickup, family strip. Parents choose who kids may
  start chats with, and kids' emergencies always reach their parents. Quiet hours 9 PM to 7 AM.
- **Chores use "parent points", not money.** Points store with rewards a parent okays. Morning and bedtime routines.
- **Simple mode** (for grandparents; on per person, admins can turn it on): big text and buttons, status card, Messages /
  Alerts / Family / Calendar tiles, a "What's new" feed of actionable cards, "See everything" opens any screen enlarged.
- **KinHelper** (simple mode): "What do you want to do?" bar, say or type. It does the action or opens the screen, shows an
  animated summary of the steps, then the user taps "Yes, that's right" or Undo. Calls always need "Confirm to call".
- **Daily "How do you feel?"** with five answers; Not great or Bad asks "Are you OK?" (I'm OK / I need help / Call someone).
  Answers go only to the people the user picks; parents see them under Family, Feelings.
- **Medicine reminders** with a nudge to chosen family if missed. **Read aloud** for updates and chats.
- **Calls** everywhere go through a "Confirm to call" panel showing the number.
- **Offline:** the app opens and works with no signal, queues changes and sends them on reconnect (including emergencies,
  which say "Not sent yet, call 911 in a real emergency" while offline). Saves its data on the phone.
- Also: Medical ID (share circle, lock-screen image, wallet), emergency plan screen, storm power board (power out / can
  host / generator), Pets, Carpool with swaps, event RSVPs and potluck slots, renewal reminders, Secret Santa (no drawing
  within a household), family tree, family stories (voice, kept for good), babysitter guest passes, School hub, Upkeep
  (house jobs, vehicles, "Where is it?"), holiday host rotation, group birthday cards, thank-you wall, savings goals
  (pledges only), install prompt with per-type notification settings, calendar subscribe link.
- Hardening found in testing, to carry into the real build: tap-through guard on lists that shift, unique IDs, length
  limits on every text field, refuse past event dates and odometer readings that go backwards, "overdue by" wording,
  Forgot PIN for the vault, focus stays inside open panels, and anything queued offline sends on next launch.

Decisions from these sessions: Logan does not want the go-bag checklist, the shared photo album or the weekly email
digest. PDFs in the vault, auto "got home" and admin-only grocery lists were not revisited (defaults stand).

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

What Logan must supply: a GCP project ID and region, a service account Claude can deploy with, and
optionally a Google OAuth client for Calendar. As of 2026-10-20 none has been supplied yet.

## Open questions for Logan (defaults in place)

Still unanswered as of 2026-10-20.

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
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and build on each push. The browser suite (`e2e/run.sh`) still runs only locally.
- The calendar-link guard checks the address before fetching, so DNS rebinding between the check and the
  connection is still theoretically possible (accepted for a family app).
- Live updates are polling (10 s), not push.

## Likely next

0. Port the prototype features above into the app, starting with emergency tiers, Enigma (with real encryption),
   kid accounts and simple mode.

1. First real deploy to GCP following the README, then fix whatever it turns up (recommended first,
   since everything else builds on a working deploy).
2. Answer the three open questions and adjust the defaults.
3. Invite the family, then mark PR #1 ready and merge it into `main`.
