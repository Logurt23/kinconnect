// Checks from the hardening pass: RLS on reservations, sniffed uploads, headers, cron auth.
// Runs after misc.mjs, which resets Ava's password to family-pass-2.
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import { browser, signIn, flash, base } from "./lib.mjs";
process.loadEnvFile(".env.local");

// Straight to PostgREST, as Ava would be if she held a token: RLS still decides.
const token = (claims) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 300 })}`;
  return `${body}.${createHmac("sha256", process.env.PGRST_JWT_SECRET).update(body).digest("base64url")}`;
};
const as = (claims) => new PostgrestClient(process.env.POSTGREST_URL, { headers: claims ? { Authorization: `Bearer ${claims.raw ?? token(claims)}` } : {} });
const { data: avaRow } = await as({ role: "service_role" }).from("profiles").select("id").eq("email", "ava@kinconnect.local").single();
console.log("anon reads nothing", Boolean((await as(null).from("profiles").select("id")).error));
console.log("forged token refused", (await as({ raw: token({ role: "service_role" }).slice(0, -4) + "AAAA" }).from("profiles").select("id")).status);
const sneaky = await as({ role: "authenticated", sub: avaRow.id }).rpc("create_profile_from_invite", { uid: avaRow.id, mail: "x@y" });
console.log("member can't call create_profile_from_invite", Boolean(sneaky.error));

// A requester can't approve or return their own reservation, only cancel it.
const sb = as({ role: "authenticated", sub: avaRow.id });
const { data: mine } = await sb.from("reservations").select("id, status, listing_id").limit(1).single();
const self = await sb.from("reservations").update({ status: "returned" }).eq("id", mine.id);
console.log("requester self-return refused", Boolean(self.error), self.error?.message);
const { data: other } = await sb.from("listings").select("id").neq("id", mine.listing_id).limit(1).single();
const moved = await sb.from("reservations").update({ listing_id: other.id }).eq("id", mine.id);
console.log("requester move refused", Boolean(moved.error));
const cancel = await sb.from("reservations").update({ status: "canceled" }).eq("id", mine.id).select("status").single();
console.log("requester cancel allowed", cancel.data?.status === "canceled");

// The vault takes text files only, judged by their bytes: a photo is refused whatever it's called.
const b = await browser();
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-2");
await ava.goto(base + "/vault");
await ava.setInputFiles("#file", { name: "notes.txt", mimeType: "text/plain", buffer: await import("node:fs").then((fs) => fs.readFileSync("e2e/drill.jpg")) });
await ava.click("text=Upload privately"); await ava.waitForLoadState("networkidle");
console.log("spoofed upload:", await flash(ava));
const csp = [];
ava.on("console", (m) => { if (/Content.Security.Policy/i.test(m.text())) csp.push(m.text()); });
for (const path of ["/", "/alerts", "/resources", "/schedule", "/vault", "/settings"]) await ava.goto(base + path);
console.log("csp violations", csp.length, csp.slice(0, 2));

// Files: only through /files, and only for those allowed. The drill photo is shared with Core only.
const { data: photo } = await as({ role: "service_role" }).from("listing_photos").select("path").limit(1).single();
const uncle = await signIn(b, "uncle@kinconnect.local", "family-pass-1");
console.log("uncle reads core-only listing photo", (await uncle.request.get(`${base}/files/listing-photos/${photo.path}`)).status());
console.log("anon reads listing photo", (await fetch(`${base}/files/listing-photos/${photo.path}`, { redirect: "manual" })).status);
const own = await ava.request.get(`${base}/files/listing-photos/${photo.path}`);
console.log("core member reads listing photo", own.status(), own.headers()["content-type"]);
await b.close();

// Security headers on every response; cron refuses a wrong secret.
const res = await fetch(base + "/login");
console.log("headers", ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"].every((h) => res.headers.get(h)));
console.log("cron wrong secret", (await fetch(base + "/api/cron/weather", { headers: { authorization: "Bearer nope" } })).status);
console.log("cron right secret", (await fetch(base + "/api/cron/weather", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status);
