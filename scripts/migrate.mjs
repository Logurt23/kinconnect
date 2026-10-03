// Applies db/*.sql in order, each once, to DATABASE_URL (the database's admin user).
//   --reset  drops every KinConnect table first (local testing only).
// AUTHENTICATOR_PASSWORD, when set, becomes the password PostgREST logs in with.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL, e.g. postgres://postgres:PASSWORD@127.0.0.1:5432/kinconnect");
  process.exit(1);
}
const db = new pg.Client({ connectionString: url });
await db.connect();
if (process.argv.includes("--reset")) {
  await db.query("drop schema if exists public cascade; drop schema if exists migrations cascade; create schema public;");
  console.log("Reset.");
}
await db.query("create schema if not exists migrations; create table if not exists migrations.applied (name text primary key, at timestamptz not null default now())");
const done = new Set((await db.query("select name from migrations.applied")).rows.map((r) => r.name));
for (const name of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(name)) continue;
  await db.query("begin");
  try {
    await db.query(readFileSync(`db/${name}`, "utf8"));
    await db.query("insert into migrations.applied (name) values ($1)", [name]);
    await db.query("commit");
    console.log(`Applied ${name}`);
  } catch (e) {
    await db.query("rollback");
    console.error(`${name} failed: ${e.message}`);
    process.exit(1);
  }
}
if (process.env.AUTHENTICATOR_PASSWORD) {
  const { rows } = await db.query("select format('alter role authenticator with login password %L', $1::text) as sql", [process.env.AUTHENTICATOR_PASSWORD]);
  await db.query(rows[0].sql);
}
// PostgREST rereads the schema when told to.
await db.query("notify pgrst, 'reload schema'");
await db.end();
