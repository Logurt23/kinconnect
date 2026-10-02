import { browser, signIn, flash, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinroot.local", "kinroot-admin-1");
const ava = await signIn(b, "ava@kinroot.local", "family-pass-1");
const uncle = await signIn(b, "uncle@kinroot.local", "family-pass-1");
const d = (n) => { const x = new Date(Date.now() + n * 86400000); return `1990-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
// Settings: birthdays (Ava in 10 days, uncle today), home base for admin (Tulsa)
await ava.goto(base + "/settings"); await ava.fill("#birthday", d(10)); await ava.click("text=Save profile"); await ava.waitForLoadState("networkidle"); console.log("ava settings:", await flash(ava));
await uncle.goto(base + "/settings"); await uncle.fill("#birthday", d(0)); await uncle.setInputFiles("#photo", "e2e/drill.jpg"); await uncle.click("text=Save profile"); await uncle.waitForLoadState("networkidle"); console.log("uncle settings:", await flash(uncle), "avatar img:", await uncle.locator("main img").count());
await admin.goto(base + "/settings"); await admin.fill("#home_label", "Tulsa, OK"); await admin.fill("#lat", "36.154"); await admin.fill("#lon", "-95.993"); await admin.click("text=Save profile"); await admin.waitForLoadState("networkidle");
await admin.goto(base + "/dates"); console.log("reminders:", await admin.locator("main > div > p.rounded-xl").allInnerTexts());
await admin.goto(base + "/"); console.log("home birthdays:", await admin.locator("section:has-text('Upcoming birthdays') li").allInnerTexts());
// Milestone by admin for Ava
await admin.goto(base + "/dates"); await admin.selectOption("#subject_id", { label: "Ava" }); await admin.selectOption("#kind", "graduation"); await admin.fill("#title", "Graduated from OSU"); await admin.fill("#link_url", "https://example.com/post/1");
await admin.click("text=Post milestone"); await admin.waitForLoadState("networkidle"); console.log("milestone:", await flash(admin));
await admin.screenshot({ path: "e2e/out/dates.png", fullPage: true });
// Lists: Ava creates list, adds URL item; admin claims; Ava can't see claim; uncle (extended, not shared) can't see list
await ava.goto(base + "/lists"); await ava.fill("input[name=title]", "Ava's Christmas"); await ava.click("text=New list"); await ava.waitForURL(/lists\/.+/);
const listUrl = ava.url().split("?")[0];
await ava.fill("input[name=url]", "https://www.amazon.com/Lodge-Cast-Iron-Skillet/dp/B00006JSUA"); await ava.fill("input[name=price]", "25"); await ava.click("text=Add item"); await ava.waitForLoadState("networkidle");
console.log("item:", await ava.locator("main li b").allInnerTexts());
await admin.goto(listUrl); await admin.click("button:has-text('Claim')"); await admin.waitForLoadState("networkidle"); console.log("admin view:", await admin.locator("main li .pill").allInnerTexts());
await ava.goto(listUrl); console.log("ava (owner) view pills:", await ava.locator("main li .pill").allInnerTexts(), "struck:", await ava.locator("main li b.line-through").count());
const r = await uncle.goto(listUrl); console.log("uncle list status:", r.status());
// Ledger: Ava requests $20 from admin; both mark paid
await ava.goto(base + "/ledger"); await ava.selectOption("#kind", "request"); await ava.selectOption("#other_id", { label: "Logan" }); await ava.fill("#amount", "20"); await ava.fill("#note", "Pizza");
await ava.click("button:has-text('Add')"); await ava.waitForLoadState("networkidle"); console.log("ledger:", await flash(ava), await ava.locator("section:has-text('Balances') li").allInnerTexts());
await admin.goto(base + "/"); console.log("admin owes on home:", await admin.locator("section:has-text('waiting on you') li").allInnerTexts());
await admin.goto(base + "/ledger"); await admin.click("text=☐ Mark paid"); await admin.waitForLoadState("networkidle");
await ava.goto(base + "/ledger"); await ava.click("text=☐ Mark paid"); await ava.waitForLoadState("networkidle");
console.log("after both:", await ava.locator("section:has-text('Entries') li").allInnerTexts());
await ava.screenshot({ path: "e2e/out/ledger.png", fullPage: true });
await b.close();
