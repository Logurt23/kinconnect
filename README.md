# KinConnect

Private family web app: one URL, invite-only sign in, a dashboard, and a left menu with Home, Alerts,
Resources, Requests, Schedule, Dates, Lists, Ledger, Weather, Vault, Family and Settings.

Built on Next.js 16 (App Router) and Google Cloud only:

| Piece | Service | How the app uses it |
| --- | --- | --- |
| App | Cloud Run | The Next.js container, with two sidecars on localhost |
| Database | Cloud SQL for PostgreSQL | Schema in `db/`, row level security on every table |
| Data API | PostgREST (open source, sidecar) | The app signs a short JWT per request (`role: authenticated`, `sub`: the member's id), so `auth.uid()` and every RLS policy apply. Admin work uses a `service_role` JWT. |
| Sign in | Identity Platform | Server-side password check, then an httpOnly session cookie. Invites and resets are its "password reset" email. |
| Files | Cloud Storage | One private bucket. Pages link to `/files/...`, which asks the database, as the member, whether they may read the file. |
| Secrets | Secret Manager | Mounted into the Cloud Run containers as env vars |
| Sweeps | Cloud Scheduler | Calls `/api/cron/weather` (every 15 min) and `/api/cron/calendars` (hourly) |

Live alerts: open pages poll `/api/live` every 10 seconds and refresh when an alert they can see opens,
closes or gets an update.

## Run locally

Needs Node 22, Docker (for Postgres, PostgREST and a Cloud Storage stand-in) and nothing else; the
Firebase Auth emulator stands in for Identity Platform and needs no Google account.

```sh
npm install
cp .env.example .env.local       # works as is; fill TOKEN_ENCRYPTION_KEY, CRON_SECRET and BOOTSTRAP_ADMIN_*
docker compose up -d             # Postgres :54322, PostgREST :3001, fake-gcs-server :4443
npx firebase-tools emulators:start --only auth --project demo-kinconnect   # leave running (Auth :9099)
curl -X POST http://127.0.0.1:4443/storage/v1/b -H "Content-Type: application/json" -d '{"name":"kinconnect-files"}'
npm run db:migrate               # applies db/*.sql (roles, schema, RLS, seed circles and categories)
npm run bootstrap-admin          # creates the first admin, in Core
npm run dev                      # http://localhost:3000
```

Invite and reset emails aren't sent locally. The emulator lists the codes at
`http://127.0.0.1:9099/emulator/v1/projects/demo-kinconnect/oobCodes`; open
`http://localhost:3000/auth/action?mode=resetPassword&oobCode=<code>` to use one.

## Deploy on Google Cloud

Run these from a machine with `gcloud` signed in as a project owner. Replace the values in the first line.

```sh
PROJECT=your-gcp-project REGION=us-central1 SITE=https://family.example.com
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com sqladmin.googleapis.com \
  identitytoolkit.googleapis.com storage.googleapis.com apikeys.googleapis.com
```

### 1. Service account

```sh
gcloud iam service-accounts create kinconnect-run
SA=kinconnect-run@$PROJECT.iam.gserviceaccount.com
for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding $PROJECT --member serviceAccount:$SA --role $role
done
```

### 2. Database (Cloud SQL)

```sh
gcloud sql instances create kinconnect --database-version POSTGRES_17 --edition ENTERPRISE \
  --tier db-f1-micro --region $REGION
gcloud sql databases create kinconnect --instance kinconnect
gcloud sql users set-password postgres --instance kinconnect --password 'CHOOSE-A-PASSWORD'
```

Apply the schema through the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy)
running on your machine (`cloud-sql-proxy $PROJECT:$REGION:kinconnect --port 5433`):

```sh
DATABASE_URL='postgres://postgres:CHOOSE-A-PASSWORD@127.0.0.1:5433/kinconnect' \
AUTHENTICATOR_PASSWORD='ANOTHER-PASSWORD' npm run db:migrate
```

`db:migrate` is safe to re-run; it applies only new files in `db/`. `db/00_platform.sql` creates the roles
PostgREST switches between (`anon`, `authenticated`, `service_role`, `authenticator`) and `auth.uid()`.

### 3. Sign in (Identity Platform)

In the console, open **Identity Platform** and enable it, then:

- **Providers**: add **Email / Password** (password sign-in, not email link).
- **Settings > Security**: turn off **Allow users to sign up** (new people only come in by invite) and
  turn on **Email enumeration protection**.
- **Settings > Authorized domains**: add your site's domain.
- **Templates > Password reset**: set **Customize action URL** to `https://YOUR-SITE/auth/action`. The same
  email is used for invites and resets, so word it for both, for example subject *Set your KinConnect
  password* and body *Use this link to choose your KinConnect password: %LINK%  If you didn't expect this,
  ignore this email.* Add your own SMTP server there before inviting more than a few people.

Create the API key the server uses for password checks, restricted to Identity Toolkit:

```sh
gcloud services api-keys create --display-name kinconnect-auth --api-target service=identitytoolkit.googleapis.com
gcloud services api-keys list   # copy the keyString of kinconnect-auth for step 5
```

### 4. Files (Cloud Storage)

```sh
gcloud storage buckets create gs://$PROJECT-kinconnect-files --location $REGION \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets add-iam-policy-binding gs://$PROJECT-kinconnect-files \
  --member serviceAccount:$SA --role roles/storage.objectAdmin
```

### 5. Secrets (Secret Manager)

```sh
secret() { printf '%s' "$2" | gcloud secrets create $1 --data-file=-; }
secret PGRST_JWT_SECRET "$(openssl rand -hex 32)"
secret PGRST_DB_URI 'postgres://authenticator:ANOTHER-PASSWORD@127.0.0.1:5432/kinconnect'
secret IDENTITY_PLATFORM_API_KEY 'THE-KEY-STRING'
secret TOKEN_ENCRYPTION_KEY "$(openssl rand -base64 32)"
secret CRON_SECRET "$(openssl rand -hex 32)"
secret GOOGLE_CLIENT_SECRET 'unset'   # or the OAuth client secret, see step 8
```

### 6. Build and deploy

```sh
gcloud artifacts repositories create kinconnect --repository-format docker --location $REGION
gcloud builds submit --region $REGION --config cloudbuild.yaml --substitutions "_REGION=$REGION,_SITE_URL=$SITE"

sed -e "s/__PROJECT__/$PROJECT/g" -e "s/__REGION__/$REGION/g" -e "s#__SITE__#$SITE#g" deploy/service.yaml > /tmp/kinconnect.yaml
gcloud run services replace /tmp/kinconnect.yaml --region $REGION
gcloud run services add-iam-policy-binding kinconnect --region $REGION --member allUsers --role roles/run.invoker
```

`cloudbuild.yaml` builds the app and copies the pinned PostgREST image into the same Artifact Registry
repository. `deploy/service.yaml` runs three containers: the app, PostgREST on `127.0.0.1:3001`, and the
Cloud SQL Auth Proxy on `127.0.0.1:5432`; only the app takes traffic. Set `NWS_USER_AGENT` (and
`GOOGLE_CLIENT_ID`, step 8) in that file before deploying. The Cloud Build service account needs Artifact
Registry Writer on the project.

Map your domain with `gcloud beta run domain-mappings create --service kinconnect --domain family.example.com`
(or a load balancer) so `SITE` is what people visit.

### 7. Sweeps (Cloud Scheduler) and the first admin

```sh
CRON="Authorization=Bearer $(gcloud secrets versions access latest --secret CRON_SECRET)"
gcloud scheduler jobs create http kinconnect-weather --location $REGION \
  --schedule "*/15 * * * *" --http-method GET --uri "$SITE/api/cron/weather" --headers "$CRON"
gcloud scheduler jobs create http kinconnect-calendars --location $REGION \
  --schedule "0 * * * *" --http-method GET --uri "$SITE/api/cron/calendars" --headers "$CRON"

gcloud auth application-default login && gcloud auth application-default set-quota-project $PROJECT
DATABASE_URL='postgres://postgres:CHOOSE-A-PASSWORD@127.0.0.1:5433/kinconnect' GOOGLE_CLOUD_PROJECT=$PROJECT \
BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='...' BOOTSTRAP_ADMIN_NAME=You \
NEXT_PUBLIC_SITE_URL=$SITE npm run bootstrap-admin   # with the Auth Proxy from step 2 still running
```

### 8. Google Calendar (optional)

Create an OAuth client (Web application) with the redirect URI `https://YOUR-SITE/api/google/callback`
and the Calendar API enabled. "Testing" mode with family members listed as test users is enough. Put the
client ID in `deploy/service.yaml` and the secret in `GOOGLE_CLIENT_SECRET`
(`printf '%s' SECRET | gcloud secrets versions add GOOGLE_CLIENT_SECRET --data-file=-`), then redeploy.
Without it, the Schedule screen says Google isn't set up and Apple subscribe links and manual blocks still work.

The Home page's quick weather check runs after the response; on Cloud Run's default billing that
background work is slowed, which is fine because the 15-minute sweep is the main one.

## How the rules are enforced

- Visibility is circle overlap (`circle_ids && my_circle_ids()`) in RLS, not in the UI. The app talks to
  the database only through PostgREST with the member's own id in a token signed by the server.
- Alerts go to the sender's circles; only an admin can add a circle they aren't in (e.g. Extended).
- Gift claims have no policy that matches the list owner, so the owner can never query them.
- Ledger "paid" needs both people's box; it is set by a database function, and no money moves.
- Files sit in a private bucket nobody can reach directly. Every read goes through `/files` (or
  `/vault/<id>/open`), which checks `can_read_object` (or the vault's RLS) as the member first.
- Google refresh tokens are AES-256-GCM encrypted and only readable by the service role.
- The 911 button tells the family. It never contacts 911, and says so.
- A requester can only cancel their own reservation; confirming, declining and returning are the owner's (a trigger enforces it).
- Uploads are typed by their first bytes, not the browser's claim; only images (and PDFs in the vault) are stored.
- Sign-up is off in Identity Platform; accounts are made by the invite action. Deactivating a member
  disables their account and their profile, so they can't sign in and RLS shows them nothing.
- Calendar subscribe links are fetched only from public addresses, re-checked on every redirect, capped at 5 MB.
- Every response carries a Content-Security-Policy, HSTS, and no-framing headers (`next.config.ts`).

## Tests

`e2e/run.sh` drives every "done when" item from the brief through a real browser against a fresh local
stack (it wipes the local database and the emulator's accounts). See the comment at the top of the script
for what must be running.
