// Quick polls: pick-one and yes/no, sent to circles, answered from Home or Polls, closed by the author.
// Runs after status-vault.mjs: Ava's password is family-pass-2.
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
const card = (p, q) => p.locator(`article:has(h3:text-is("${q}"))`);
const DINNER = "What should we have for dinner tonight?";
const LUNCH = "Sunday lunch at Grandma's?";

// Ava: pick-one with a write-in, to Core (her default).
await ava.goto(base + "/polls");
await ava.fill("#question", DINNER);
const opts = ava.locator("input[name=option]");
await opts.nth(0).fill("Tacos"); await opts.nth(1).fill("Pizza"); await opts.nth(2).fill("Grill out");
await ava.check("input[name=allow_other]");
await ava.click("text=Send poll"); await ava.waitForSelector("text=Poll sent.");

// Logan sees it waiting on Home and answers there; then it leaves Home.
await admin.goto(base + "/");
console.log("waiting on admin:", await admin.locator("section:has(h2:text-is('Polls waiting on you')) h3").allInnerTexts());
await card(admin, DINNER).locator("button:has-text('Pizza')").click(); await admin.waitForSelector("text=Vote counted.");
console.log("after answering, still waiting:", await admin.locator("section:has(h2:text-is('Polls waiting on you'))").count());

// Uncle is Extended only: he doesn't get a Core poll, even by asking the database.
await uncle.goto(base + "/polls"); console.log("uncle sees dinner poll:", await card(uncle, DINNER).count());
console.log("uncle reads it directly:", (await as({ role: "authenticated", sub: await idOf("uncle@kinconnect.local") }).from("polls").select("id").eq("question", DINNER)).data.length);
// ...and can't send one to Core, which he isn't in.
const { data: core } = await service.from("circles").select("id").eq("kind", "core").single();
const sneaky = await as({ role: "authenticated", sub: await idOf("uncle@kinconnect.local") }).from("polls")
  .insert({ author_id: await idOf("uncle@kinconnect.local"), question: "x", kind: "yes_no", circle_ids: [core.id] });
console.log("uncle can't post to Core:", Boolean(sneaky.error));

// Ava votes Tacos, changes her mind to a write-in; the tally follows.
await ava.goto(base + "/polls");
await card(ava, DINNER).locator("button:has-text('Tacos')").click(); await ava.waitForSelector("text=Vote counted.");
await card(ava, DINNER).locator("input[name=other_text]").fill("Breakfast for dinner");
await card(ava, DINNER).locator("button:text-is('Answer')").click(); await ava.waitForSelector("li:has-text('Breakfast for dinner')");
console.log("dinner tally:", (await card(ava, DINNER).locator("ul li button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")));
console.log("write-ins:", await card(ava, DINNER).locator("ul.text-sm li").allInnerTexts());

// Logan: yes/no to Core and Extended; Uncle answers Yes.
await admin.goto(base + "/polls");
await admin.fill("#question", LUNCH); await admin.check("#kind-yesno");
console.log("options hidden for yes/no:", !(await admin.locator("input[name=option]").first().isVisible()));
await admin.locator("form:has(#question) input[name=circle_ids]").nth(1).check();
await admin.click("text=Send poll"); await admin.waitForSelector("text=Poll sent.");
await uncle.goto(base + "/"); await card(uncle, LUNCH).locator("button:has-text('Yes')").click(); await uncle.waitForSelector("text=Vote counted.");
await admin.goto(base + "/polls");
console.log("lunch tally:", (await card(admin, LUNCH).locator("ul li button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")));
console.log("no write-in box on yes/no:", await card(admin, LUNCH).locator("input[name=other_text]").count());

// Ava closes hers: buttons go inert and the database refuses late votes.
await ava.goto(base + "/polls");
ava.once("dialog", (d) => d.accept());
await card(ava, DINNER).locator("button:has-text('Close poll')").click(); await ava.waitForSelector("text=Poll closed.");
await admin.goto(base + "/polls");
console.log("closed poll buttons disabled:", await card(admin, DINNER).locator("ul li button").first().isDisabled());
const { data: dinner } = await service.from("polls").select("id, options:poll_options(id, label)").eq("question", DINNER).single();
const late = await as({ role: "authenticated", sub: await idOf("admin@kinconnect.local") }).from("poll_votes")
  .update({ option_id: dinner.options.find((o) => o.label === "Grill out").id }).eq("poll_id", dinner.id).select();
console.log("late vote refused:", !late.data?.length);
await admin.screenshot({ path: "e2e/out/polls.png", fullPage: true });
await b.close();
