// Creates the first admin (in Core) from BOOTSTRAP_ADMIN_* env vars. Safe to re-run.
// Uses DATABASE_URL (the admin connection `npm run db:migrate` uses) and Identity Platform through
// firebase-admin: Application Default Credentials in production, FIREBASE_AUTH_EMULATOR_HOST locally.
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import pg from "pg";

const { DATABASE_URL: url, GOOGLE_CLOUD_PROJECT: projectId, BOOTSTRAP_ADMIN_EMAIL: rawEmail,
  BOOTSTRAP_ADMIN_PASSWORD: password, BOOTSTRAP_ADMIN_NAME: name } = process.env;
if (!url || !projectId || !rawEmail || !password) {
  console.error("Set DATABASE_URL, GOOGLE_CLOUD_PROJECT, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.");
  process.exit(1);
}
const email = rawEmail.toLowerCase();
const db = new pg.Client({ connectionString: url });
await db.connect();
const auth = getAuth(initializeApp({ projectId }));
const one = async (sql, args) => (await db.query(sql, args)).rows[0];

const core = await one("select id from circles where kind = 'core'");
const existing = await one("select id from profiles where email = $1", [email]);
if (existing) {
  await db.query("update profiles set role = 'admin', active = true where id = $1", [existing.id]);
  await db.query("insert into circle_members (circle_id, user_id) values ($1, $2) on conflict do nothing", [core.id, existing.id]);
  await auth.updateUser(existing.id, { disabled: false });
  console.log(`${email} is an admin.`);
} else {
  await db.query(
    "insert into invites (email, display_name, role, circle_ids) values ($1, $2, 'admin', $3) on conflict (email) do update set role = 'admin', circle_ids = excluded.circle_ids",
    [email, name || email.split("@")[0], [core.id]],
  );
  const user = (await auth.getUserByEmail(email).catch(() => null))
    ?? (await auth.createUser({ uid: randomUUID(), email, password, emailVerified: true }));
  await auth.updateUser(user.uid, { password, disabled: false });
  await db.query("select create_profile_from_invite($1, $2)", [user.uid, email]);
  // The admin has a password already, so there is no invite left to accept.
  await db.query("delete from invites where email = $1", [email]);
  console.log(`Created admin ${email}. Sign in at ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login`);
}
await db.end();
