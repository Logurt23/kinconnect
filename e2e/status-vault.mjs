// Family status board, SOS, storm mode, and the vault's locked section and space limit.
// Runs last: Ava's password is family-pass-2 after misc.mjs, and Logan's home base has the stub's tornado warning.
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import { browser, signIn, base } from "./lib.mjs";
process.loadEnvFile(".env.local");
const token = (claims) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 300 })}`;
  return `${body}.${createHmac("sha256", process.env.PGRST_JWT_SECRET).update(body).digest("base64url")}`;
};
const as = (claims) => new PostgrestClient(process.env.POSTGREST_URL, { headers: { Authorization: `Bearer ${token(claims)}` } });
const service = as({ role: "service_role" });
const idOf = async (email) => (await service.from("profiles").select("id").eq("email", email).single()).data.id;

const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-2");
const uncle = await signIn(b, "uncle@kinconnect.local", "family-pass-1");
const board = async (p) => { await p.goto(base + "/"); return p.locator("section:has(h2:text-is('Family status')) ul li").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim())); };

// Off by default: no board on Home.
console.log("board hidden until turned on", (await board(admin)).length === 0);
for (const p of [admin, ava, uncle]) {
  await p.goto(base + "/settings"); await p.check("input[name=status_sharing]");
  await p.click("text=Save family status"); await p.waitForSelector("text=Family status is on");
}
// Ava: out of town, with a note and date, from the More form.
await ava.goto(base + "/");
await ava.click("summary:has-text('More')");
await ava.selectOption("#status-more", "out_of_town"); await ava.fill("#status-note", "Visiting Grandma"); await ava.fill("#status-until", "2026-10-12");
await ava.click("form:has(#status-more) button[type=submit]"); await ava.waitForSelector("text=Status set: Out of town");
// Logan: one tap "Still exploring".
await admin.goto(base + "/"); await admin.click("button[value=exploring]"); await admin.waitForSelector("text=Status set: Still exploring");
console.log("admin board:", await board(admin));
console.log("ava board:", await board(ava));
// Uncle is Extended only, so he shares no circle with Ava or Logan: their statuses stay hidden from him.
console.log("uncle board:", await board(uncle));
const uncleRows = (await as({ role: "authenticated", sub: await idOf("uncle@kinconnect.local") }).from("member_statuses").select("user_id")).data;
console.log("uncle reads others' statuses directly", uncleRows.length);

// SOS asks first, then pins a family emergency for Ava; Safe closes it.
await admin.goto(base + "/");
admin.once("dialog", (d) => { console.log("sos confirm:", d.message()); d.accept(); });
await admin.click("button[value=sos]"); await admin.waitForURL(/alerts\/.+/); console.log("sos:", await admin.locator("text=SOS sent").textContent());
await ava.goto(base + "/"); console.log("ava pinned:", await ava.locator("main a.border-2").allInnerTexts().then((t) => t.filter((x) => x.includes("SOS"))));
await admin.goto(base + "/"); await admin.click("button[value=safe]"); await admin.waitForSelector("text=Status set: Safe");
await ava.goto(base + "/"); console.log("ava pinned after safe:", (await ava.locator("main a.border-2").allInnerTexts()).filter((x) => x.includes("SOS")).length);

// Storm mode: Logan's home base has a tornado warning, so check-ins come first on Home.
await admin.goto(base + "/");
console.log("storm mode:", await admin.locator("#storm-title").textContent().catch(() => null));
console.log("storm first:", await admin.evaluate(() => {
  const storm = document.querySelector("#storm-title"); const unread = [...document.querySelectorAll("h2")].find((h) => h.textContent === "Unread alerts");
  return Boolean(storm && unread && storm.compareDocumentPosition(unread) & Node.DOCUMENT_POSITION_FOLLOWING);
}));
await admin.screenshot({ path: "e2e/out/home-storm.png", fullPage: true });

// Ava turns it off: Logan sees "Not sharing", and her row is hidden.
await ava.goto(base + "/settings"); await ava.uncheck("input[name=status_sharing]"); await ava.click("text=Save family status"); await ava.waitForSelector("text=Family status is off");
console.log("after ava turns off:", (await board(admin)).find((t) => t.includes("Ava")));
await ava.goto(base + "/settings"); await ava.check("input[name=status_sharing]"); await ava.click("text=Save family status"); await ava.waitForSelector("text=Family status is on");

// Vault: locked section behind a PIN.
await ava.goto(base + "/vault");
await ava.fill("#new-pin", "2468"); await ava.fill("#confirm-pin", "2468"); await ava.click("text=Set PIN"); await ava.waitForSelector("text=PIN set");
await ava.setInputFiles("#file", { name: "passwords.txt", mimeType: "text/plain", buffer: Buffer.from("router: hunter2\n") });
await ava.fill("#title", "Router passwords"); await ava.check("input[name=locked]");
await ava.click("text=Upload privately"); await ava.waitForSelector("text=Uploaded to your locked section");
const lockedHref = await ava.locator("a:has-text('Router passwords')").getAttribute("href");
console.log("open while unlocked:", (await ava.request.get(base + lockedHref)).status());
await ava.click("text=Lock now"); await ava.waitForSelector("text=Locked.");
console.log("listed while locked:", await ava.locator("a:has-text('Router passwords')").count());
console.log("open while locked:", (await ava.request.get(base + lockedHref)).status());
const { data: lockedRow } = await service.from("vault_items").select("path").eq("title", "Router passwords").single();
console.log("file route while locked:", (await ava.request.get(`${base}/files/vault/${lockedRow.path}`)).status());
console.log("db rows while locked:", (await as({ role: "authenticated", sub: await idOf("ava@kinconnect.local") }).from("vault_items").select("id").eq("title", "Router passwords")).data.length);
console.log("forged unlock claim still needs her id:", (await as({ role: "authenticated", sub: await idOf("admin@kinconnect.local"), vault_unlocked: true }).from("vault_items").select("id").eq("title", "Router passwords")).data.length);
await ava.fill("#pin", "1111"); await ava.click("button:text-is('Unlock')"); console.log("wrong pin:", await ava.locator("text=Wrong PIN").textContent());
await ava.fill("#pin", "2468"); await ava.click("button:text-is('Unlock')"); await ava.waitForSelector("text=Unlocked for 15 minutes");
console.log("open after unlock:", (await ava.request.get(base + lockedHref)).status(), await (await ava.request.get(base + lockedHref)).text());
const sharedAttempt = await as({ role: "authenticated", sub: await idOf("ava@kinconnect.local"), vault_unlocked: true }).from("vault_shares")
  .insert({ item_id: (await service.from("vault_items").select("id").eq("title", "Router passwords").single()).data.id, user_id: await idOf("admin@kinconnect.local") });
console.log("locked file can't be shared:", Boolean(sharedAttempt.error));
await ava.screenshot({ path: "e2e/out/vault-locked.png", fullPage: true });

// 1 GB each: the database refuses a row that would go over, whatever the app does.
const big = await service.from("vault_items").insert({ owner_id: await idOf("ava@kinconnect.local"), title: "huge", path: "x/huge", mime: "text/plain", size_bytes: 1073741824 });
console.log("over 1 GB refused:", big.error?.message);
console.log("space shown:", await ava.locator("text=of 1 GB").textContent());
await b.close();
