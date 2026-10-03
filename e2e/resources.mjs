import { browser, signIn, flash, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-1");
const uncle = await signIn(b, "uncle@kinconnect.local", "family-pass-1");
async function list(p, title, offer, extra = {}) {
  await p.goto(base + "/resources/new");
  await p.fill("#title", title);
  await p.check(`input[value=${offer}]`);
  if (offer === "sell") await p.fill("input[name=price]", "40");
  if (extra.photo) await p.setInputFiles("#photos", extra.photo);
  if (extra.extended) await p.locator("input[name=circle_ids]").nth(1).check();
  await p.click("text=List it"); await p.waitForURL(/resources\/[0-9a-f-]{36}/);
  console.log("listed", title, await p.locator("main p.text-muted").first().textContent());
  return p.url().split("?")[0];
}
const drill = await list(admin, "Cordless drill", "loan", { photo: "e2e/drill.jpg" });
await list(admin, "Old couch", "sell", { extended: true });
await list(admin, "Baby clothes", "give");
// Uncle (extended) sees only the couch
await uncle.goto(base + "/resources"); console.log("uncle sees:", await uncle.locator("main li b").allInnerTexts());
// Ava reserves drill
await ava.goto(drill); await ava.fill("input[name=note]", "For the deck"); await ava.click("text=Request to reserve");
await ava.waitForLoadState("networkidle"); console.log("ava:", await flash(ava));
await admin.goto(base + "/"); console.log("admin waiting:", await admin.locator("section:has-text('waiting on you') li").allInnerTexts());
await admin.goto(drill); await admin.click("button[value=confirm]"); await admin.waitForLoadState("networkidle");
console.log("drill status:", await admin.locator("main .pill").first().textContent());
await admin.screenshot({ path: "e2e/out/listing.png", fullPage: true });
await ava.goto(base + "/"); console.log("ava reserved:", await ava.locator("section:has-text('waiting on you') li").allInnerTexts());
// Requests: uncle asks for airport pickup to Extended; admin claims; admin marks done
await uncle.goto(base + "/requests");
await uncle.selectOption("#category_id", { label: "Airport pickup" }); await uncle.fill("#where_text", "XNA"); await uncle.fill("#note", "Landing at 4pm"); await uncle.locator("input[name=circle_ids]").nth(0).check();
await uncle.click("text=Post request"); await uncle.waitForLoadState("networkidle"); console.log("uncle req:", await flash(uncle));
await ava.goto(base + "/requests"); console.log("ava sees open:", await ava.locator("section:has-text('Open in your circles') li").count());
await admin.goto(base + "/requests"); await admin.click("button[value=claim]"); await admin.waitForLoadState("networkidle");
console.log("admin claimed:", await admin.locator("section:has-text('You claimed') li").allInnerTexts());
await admin.click("section:has-text('You claimed') button[value=done]"); await admin.waitForLoadState("networkidle");
await admin.waitForSelector("section:has-text('Finished') li");
console.log("finished:", await admin.locator("section:has-text('Finished') li").allInnerTexts());
await admin.screenshot({ path: "e2e/out/requests.png", fullPage: true });
await b.close();
