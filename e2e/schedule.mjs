import { browser, signIn, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-1");
const uncle = await signIn(b, "uncle@kinconnect.local", "family-pass-1");
// Ava pastes an Apple subscribe link (served by the stub)
await ava.goto(base + "/schedule"); await ava.fill("input[name=ics_url]", "http://127.0.0.1:4555/family.ics"); await ava.fill("input[name=label]", "Ava iCloud");
await ava.click("text=Add subscribe link"); await ava.waitForSelector("text=Subscribe link added");
console.log("source:", await ava.locator("section:has-text('My calendars') li").first().innerText());
// Admin adds a manual block
await admin.goto(base + "/schedule"); await admin.fill("input[name=title]", "Out of town"); await admin.check("input[name=all_day]"); await admin.click("text=Add block"); await admin.waitForSelector("text=Block added.");
// Admin sees Ava busy only; Ava sees her own titles
await admin.goto(base + "/schedule?view=week"); console.log("admin week:", await admin.locator("main section.card li[title]").evaluateAll((els) => els.map((e) => e.title)));
await ava.goto(base + "/schedule?view=week"); console.log("ava week:", await ava.locator("main section.card li[title]").evaluateAll((els) => els.map((e) => e.title)));
// Ava opts in to titles
await ava.selectOption("select[name=detail]", "titles"); await ava.click("section:has-text('My calendars') button:has-text('Save')"); await ava.waitForSelector("text=Sharing saved.");
await admin.goto(base + "/schedule?view=month"); console.log("admin month:", await admin.locator("main section.card li[title]").evaluateAll((els) => [...new Set(els.map((e) => e.title))]));
await admin.screenshot({ path: "e2e/out/schedule.png", fullPage: true });
await uncle.goto(base + "/schedule"); console.log("uncle sees:", await uncle.locator("main section.card li[title]").count());
await admin.goto(base + "/"); console.log("home next 7:", await admin.locator("section:has-text('Next 7 days') li").allInnerTexts());
console.log("google button:", await admin.locator("text=Google isn't set up").count());
await b.close();
