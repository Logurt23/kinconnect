# Kinroot

Private family web app: one URL, invite-only sign in, a dashboard, and a left menu with Home, Alerts,
Resources, Requests, Schedule, Dates, Lists, Ledger, Weather, Vault, Family and Settings.

Built on Next.js 16 (App Router) and Supabase (Auth, Postgres with row level security on every table,
private Storage, Realtime). The build plan is in the project's `kinroot/build-packet.md`.

## Run locally

Needs Node 22 and Docker.

```sh
npm install
npm run db:start                 # local Supabase; prints the URL and keys
cp .env.example .env.local       # paste API_URL, PUBLISHABLE_KEY, SECRET_KEY; fill TOKEN_ENCRYPTION_KEY and BOOTSTRAP_ADMIN_*
npm run db:reset                 # applies supabase/migrations (schema, RLS, buckets, seed circles and categories)
npm run bootstrap-admin          # creates the first admin, in Core
npm run dev                      # http://localhost:3000
```

Invite and password-reset emails go to Mailpit at http://127.0.0.1:54324 locally.

## Deploy

1. Create a Supabase project. Run the migration (`npx supabase link` then `npx supabase db push`).
2. In Supabase Auth settings: turn off "Allow new users to sign up", keep the Email provider on, set the
   Site URL to the deployed URL, and paste `supabase/templates/invite.html` and `recovery.html` into the
   Invite and Reset Password email templates. Add custom SMTP before inviting more than a few people.
3. Set the env vars from `.env.example` on the host (Vercel works; `vercel.json` schedules the weather and
   calendar sweeps, which authenticate with `CRON_SECRET`).
4. Google Calendar (optional): create an OAuth client (Web application) in Google Cloud with the
   redirect URI `https://YOUR-SITE/api/google/callback` and the Calendar API enabled. "Testing" mode with
   family members listed as test users is enough. Without it, the Schedule screen says Google isn't set up
   and Apple subscribe links and manual blocks still work.
5. `npm run bootstrap-admin` once with the production keys to create the first admin.

## How the rules are enforced

- Visibility is circle overlap (`circle_ids && my_circle_ids()`) in RLS, not in the UI.
- Alerts go to the sender's circles; only an admin can add a circle they aren't in (e.g. Extended).
- Gift claims have no policy that matches the list owner, so the owner can never query them.
- Ledger "paid" needs both people's box; it is set by a database function, and no money moves.
- Vault files live in a private bucket; links are signed for 60 seconds at the moment of the click.
- Google refresh tokens are AES-256-GCM encrypted and only readable with the service key.
- The 911 button tells the family. It never contacts 911, and says so.

## Tests

`e2e/run.sh` drives every "done when" item from the brief through a real browser against a fresh local
database (it wipes it). See the comment at the top of the script for what must be running.
