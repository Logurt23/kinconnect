# KinConnect

Private family web app: one URL, invite-only sign in, a dashboard, and a left menu with Home, Alerts,
Resources, Requests, Schedule, Dates, Lists, Ledger, Weather, Vault, Family and Settings.

Built on Next.js 16 (App Router) and Supabase (Auth, Postgres with row level security on every table,
private Storage, Realtime). The build plan is in the project's `kinconnect/build-packet.md`.

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
   Under Rate Limits, lower the sign-in/OTP and email limits (KinConnect has no rate limiter of its own).
3. Set the env vars from `.env.example` on the host (Vercel works; `vercel.json` schedules the weather and
   calendar sweeps, which authenticate with `CRON_SECRET`).
4. Google Calendar (optional): create an OAuth client (Web application) in Google Cloud with the
   redirect URI `https://YOUR-SITE/api/google/callback` and the Calendar API enabled. "Testing" mode with
   family members listed as test users is enough. Without it, the Schedule screen says Google isn't set up
   and Apple subscribe links and manual blocks still work.
5. `npm run bootstrap-admin` once with the production keys to create the first admin.

## Deploy on Google Cloud (Cloud Run)

The app runs as a container on Cloud Run; Supabase still holds the database, sign-in and files. Do Deploy
steps 1, 2, 4 and 5 above, then:

```sh
PROJECT=your-gcp-project REGION=us-central1 SITE=https://family.example.com
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com --project $PROJECT

# Secrets live in Secret Manager, not in the image.
for s in SUPABASE_SECRET_KEY TOKEN_ENCRYPTION_KEY CRON_SECRET GOOGLE_CLIENT_SECRET; do
  printf '%s' "<value>" | gcloud secrets create $s --data-file=- --project $PROJECT
done

# NEXT_PUBLIC_* values are baked in at build time (cloudbuild.yaml).
gcloud builds submit --project $PROJECT --region $REGION --config cloudbuild.yaml \
  --substitutions "_REGION=$REGION,_SUPABASE_URL=https://YOUR-REF.supabase.co,_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...,_SITE_URL=$SITE"

gcloud run deploy kinconnect --project $PROJECT --region $REGION --allow-unauthenticated \
  --image $REGION-docker.pkg.dev/$PROJECT/kinconnect/app \
  --set-env-vars "APP_TIMEZONE=America/Chicago,NWS_USER_AGENT=KinConnect family app (you@example.com),GOOGLE_CLIENT_ID=...,NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...,NEXT_PUBLIC_SITE_URL=$SITE" \
  --set-secrets "SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest,TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest,CRON_SECRET=CRON_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"

# The two sweeps that vercel.json schedules on Vercel.
CRON="Authorization=Bearer $(gcloud secrets versions access latest --secret CRON_SECRET --project $PROJECT)"
gcloud scheduler jobs create http kinconnect-weather --project $PROJECT --location $REGION \
  --schedule "*/15 * * * *" --http-method GET --uri "$SITE/api/cron/weather" --headers "$CRON"
gcloud scheduler jobs create http kinconnect-calendars --project $PROJECT --location $REGION \
  --schedule "0 * * * *" --http-method GET --uri "$SITE/api/cron/calendars" --headers "$CRON"
```

The Cloud Build service account needs Artifact Registry write access (create the `kinconnect` repository
first with `gcloud artifacts repositories create kinconnect --repository-format docker --location $REGION`),
and the Cloud Run service account needs Secret Manager Secret Accessor. Map your domain with
`gcloud run domain-mappings create` or a load balancer, and use that domain as the Supabase Site URL and
the Google OAuth redirect. The Home page's quick weather check runs after the response; on Cloud Run's
default billing that background work is slowed, which is fine because the 15-minute sweep is the main one.

## How the rules are enforced

- Visibility is circle overlap (`circle_ids && my_circle_ids()`) in RLS, not in the UI.
- Alerts go to the sender's circles; only an admin can add a circle they aren't in (e.g. Extended).
- Gift claims have no policy that matches the list owner, so the owner can never query them.
- Ledger "paid" needs both people's box; it is set by a database function, and no money moves.
- Vault files live in a private bucket; links are signed for 60 seconds at the moment of the click.
- Google refresh tokens are AES-256-GCM encrypted and only readable with the service key.
- The 911 button tells the family. It never contacts 911, and says so.
- A requester can only cancel their own reservation; confirming, declining and returning are the owner's (a trigger enforces it).
- Uploads are typed by their first bytes, not the browser's claim, and the buckets only accept images (and PDFs in the vault).
- Calendar subscribe links are fetched only from public addresses, re-checked on every redirect, capped at 5 MB.
- Every response carries a Content-Security-Policy, HSTS, and no-framing headers (`next.config.ts`).

## Tests

`e2e/run.sh` drives every "done when" item from the brief through a real browser against a fresh local
database (it wipes it). See the comment at the top of the script for what must be running.
