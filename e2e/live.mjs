// Live refresh: an open page picks up a new alert from someone else without a reload (polls /api/live).
import { browser, signIn, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
const ava = await signIn(b, "ava@kinconnect.local", "family-pass-2");
await admin.goto(base + "/alerts");
await ava.goto(base + "/alerts");
await ava.fill("textarea[name=message] >> nth=0", "Live check: leaving now");
await ava.click("text=Send notice"); await ava.waitForURL(/alerts\/.+/);
const seen = await admin.waitForSelector("text=Live check: leaving now", { timeout: 25000 }).then(() => true, () => false);
console.log("open page refreshed itself", seen);
await b.close();
