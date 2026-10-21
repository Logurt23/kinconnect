// Grocery lists: Logan starts one, everyone adds from their own account, the shopper checks things off.
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
const list = (p, title) => p.locator(`article:has(h3:text-is("${title}"))`);
const add = async (p, title, name, qty = "", note = "") => {
  const l = list(p, title);
  await l.locator("input[name=name]").fill(name);
  if (qty) await l.locator("input[name=qty]").fill(qty);
  if (note) await l.locator("input[name=note]").fill(note);
  await l.locator("button:text-is('Add')").click();
  await p.waitForSelector(`text=Added ${name}.`);
};
const names = async (p, title) => list(p, title).locator("ul li").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim()));

// Logan starts a list for Core and Extended, and a Core-only one.
await admin.goto(base + "/groceries");
await admin.fill("#title", "Costco Saturday"); await admin.fill("#shop_on", "2026-10-10");
await admin.locator("form:has(#title) input[name=circle_ids]").nth(1).check();
await admin.click("text=Start list"); await admin.waitForSelector("text=Costco Saturday is open");
await admin.fill("#title", "Birthday party run"); await admin.click("text=Start list"); await admin.waitForSelector("text=Birthday party run is open");

// Everyone adds what they want from their own account.
await admin.goto(base + "/groceries"); await add(admin, "Costco Saturday", "Milk", "2 gallons");
await ava.goto(base + "/"); console.log("ava home:", await ava.locator("section:has(h2:text-is('Grocery lists')) li").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " "))));
await ava.goto(base + "/groceries"); await add(ava, "Costco Saturday", "Honeycrisp apples", "6", "the big ones");
await uncle.goto(base + "/groceries"); await add(uncle, "Costco Saturday", "Coffee", "", "dark roast");
console.log("uncle sees Core-only list:", await list(uncle, "Birthday party run").count());
await ava.goto(base + "/groceries"); console.log("ava sees:", await names(ava, "Costco Saturday"));
console.log("ava's trash buttons on others' items:", await list(ava, "Costco Saturday").locator("li:has-text('Coffee') button[aria-label^=Remove]").count());

// Uncle can't rewrite or remove Ava's item, even straight at the database.
const uncleDb = as({ role: "authenticated", sub: await idOf("uncle@kinconnect.local") });
const { data: apples } = await service.from("grocery_items").select("id").eq("name", "Honeycrisp apples").single();
const rename = await uncleDb.from("grocery_items").update({ name: "Candy" }).eq("id", apples.id);
console.log("uncle can't rename Ava's item:", rename.error?.message);
const del = await uncleDb.from("grocery_items").delete().eq("id", apples.id).select();
console.log("uncle can't delete Ava's item:", !del.data?.length);

// Logan shops: checks off the apples; Ava sees who got them.
await admin.goto(base + "/groceries");
await list(admin, "Costco Saturday").locator("button[aria-label='Got it: Honeycrisp apples']").click();
await admin.waitForSelector("button[aria-label='Not got: Honeycrisp apples']");
await ava.goto(base + "/groceries"); console.log("after checking:", await names(ava, "Costco Saturday"));
await admin.screenshot({ path: "e2e/out/groceries.png", fullPage: true });

// Clear the cart, then done shopping: nobody can add after that.
await list(admin, "Costco Saturday").locator("button:has-text('Clear what')").click(); await admin.waitForSelector("text=Cleared what's been bought.");
console.log("after clearing:", await names(admin, "Costco Saturday"));
admin.once("dialog", (d) => d.accept());
await list(admin, "Costco Saturday").locator("button:has-text('Done shopping')").click(); await admin.waitForSelector("text=Marked done.");
await ava.goto(base + "/groceries");
console.log("ava's add box on a done list:", await list(ava, "Costco Saturday").locator("input[name=name]").count());
const { data: costco } = await service.from("grocery_lists").select("id").eq("title", "Costco Saturday").single();
const late = await as({ role: "authenticated", sub: await idOf("ava@kinconnect.local") }).from("grocery_items")
  .insert({ list_id: costco.id, name: "Late add", added_by: await idOf("ava@kinconnect.local") });
console.log("late add refused:", Boolean(late.error));
await b.close();
