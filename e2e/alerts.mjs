import { browser, signIn, flash, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-1");
const uncle = await signIn(b, "uncle@kinconnect.local", "family-pass-1");
const pinned = async (p) => { await p.goto(base + "/"); return p.locator("main a.border-2").allInnerTexts(); };
const unread = async (p) => (await p.locator("aside [aria-label$=unread]").first().textContent().catch(() => "0"));

// notice to Core
await ava.goto(base + "/alerts");
await ava.fill("textarea[name=message] >> nth=0", "Dinner at 6 on Sunday");
await ava.click("text=Send notice");
await ava.waitForURL(/alerts\/.+/); console.log("notice:", await flash(ava));
await admin.goto(base + "/alerts"); console.log("admin badge", await unread(admin), "| sees notice", await admin.locator("text=Dinner at 6").count());
await uncle.goto(base + "/alerts"); console.log("uncle sees notice", await uncle.locator("text=Dinner at 6").count());

// 911 from Ava to Core
await ava.goto(base + "/alerts");
ava.once("dialog", (d) => { console.log("confirm text:", d.message()); d.accept(); });
await ava.fill("input[name=location_label] >> nth=0", "Grandma's house");
await ava.click("text=Send 911 emergency to family");
await ava.waitForURL(/alerts\/.+/); const emId = ava.url().split("/").pop().split("?")[0];
console.log("admin pinned:", await pinned(admin)); console.log("uncle pinned:", await pinned(uncle));

// Family emergency from admin to Core + Extended
await admin.goto(base + "/alerts");
const fam = admin.locator("form:has(input[value=emergency_family])");
await fam.locator("textarea").fill("Car broke down on I-44");
await fam.locator("input[name=circle_ids]").nth(1).check();
admin.once("dialog", (d) => d.accept());
await fam.locator("button[type=submit]").click();
await admin.waitForURL(/alerts\/.+/);
console.log("uncle pinned:", await pinned(uncle));
// Uncle posts a status update, admin sees it
await uncle.locator("main a.border-2").first().click(); await uncle.waitForURL(/alerts\/.+/);
await uncle.click("button[value=heading_over]"); await uncle.waitForLoadState("networkidle");
console.log("uncle update:", await uncle.locator("ol li").allInnerTexts());

// Ava closes the 911
await ava.goto(base + "/alerts/" + emId);
ava.once("dialog", (d) => d.accept());
await ava.click("text=Close emergency"); await ava.waitForLoadState("networkidle");
console.log("after close, admin pinned:", await pinned(admin));
await admin.screenshot({ path: "e2e/out/home-pinned.png", fullPage: true });
await admin.goto(base + "/alerts"); await admin.screenshot({ path: "e2e/out/alerts.png", fullPage: true });
await b.close();
