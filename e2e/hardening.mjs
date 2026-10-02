// Checks from the hardening pass: RLS on reservations, sniffed uploads, headers, cron auth.
// Runs after misc.mjs, which resets Ava's password to family-pass-2.
import { createClient } from "@supabase/supabase-js";
import { browser, signIn, flash, base } from "./lib.mjs";
process.loadEnvFile(".env.local");

// A requester can't approve or return their own reservation, only cancel it.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: "ava@kinconnect.local", password: "family-pass-2" });
const { data: mine } = await sb.from("reservations").select("id, status, listing_id").limit(1).single();
const self = await sb.from("reservations").update({ status: "returned" }).eq("id", mine.id);
console.log("requester self-return refused", Boolean(self.error), self.error?.message);
const { data: other } = await sb.from("listings").select("id").neq("id", mine.listing_id).limit(1).single();
const moved = await sb.from("reservations").update({ listing_id: other.id }).eq("id", mine.id);
console.log("requester move refused", Boolean(moved.error));
const cancel = await sb.from("reservations").update({ status: "canceled" }).eq("id", mine.id).select("status").single();
console.log("requester cancel allowed", cancel.data?.status === "canceled");

// Uploads are typed by their bytes: a text file claiming to be a PNG is refused.
const b = await browser();
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-2");
await ava.goto(base + "/vault");
await ava.setInputFiles("#file", { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
await ava.click("text=Upload privately"); await ava.waitForLoadState("networkidle");
console.log("spoofed upload:", await flash(ava));
const csp = [];
ava.on("console", (m) => { if (/Content.Security.Policy/i.test(m.text())) csp.push(m.text()); });
for (const path of ["/", "/alerts", "/resources", "/schedule", "/vault", "/settings"]) await ava.goto(base + path);
console.log("csp violations", csp.length, csp.slice(0, 2));
await b.close();

// Security headers on every response; cron refuses a wrong secret.
const res = await fetch(base + "/login");
console.log("headers", ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"].every((h) => res.headers.get(h)));
console.log("cron wrong secret", (await fetch(base + "/api/cron/weather", { headers: { authorization: "Bearer nope" } })).status);
console.log("cron right secret", (await fetch(base + "/api/cron/weather", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status);
