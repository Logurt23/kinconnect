// Creates the first admin (in Core) from BOOTSTRAP_ADMIN_* env vars. Safe to re-run.
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, BOOTSTRAP_ADMIN_EMAIL: email,
  BOOTSTRAP_ADMIN_PASSWORD: password, BOOTSTRAP_ADMIN_NAME: name } = process.env;
if (!url || !key || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: circles, error } = await db.from("circles").select("id, kind");
if (error) throw error;
const core = circles.find((c) => c.kind === "core");

const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
if (existing) {
  await db.from("profiles").update({ role: "admin", active: true }).eq("id", existing.id);
  await db.from("circle_members").upsert({ circle_id: core.id, user_id: existing.id });
  console.log(`${email} is an admin.`);
  process.exit(0);
}
await db.from("invites").upsert({ email, display_name: name || email.split("@")[0], role: "admin", circle_ids: [core.id] });
const { error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (createError) throw createError;
console.log(`Created admin ${email}. Sign in at ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login`);
