import { browser, signIn, inviteLink, flash, base } from "./lib.mjs";
const b = await browser();
// Password reset by email
const ctx = await b.newContext(); const p = await ctx.newPage();
await p.goto(base + "/auth/forgot-password"); await p.fill("#email", "ava@kinroot.local"); await p.click("button[type=submit]"); await p.waitForSelector("text=reset link is on its way");
await new Promise((r) => setTimeout(r, 1500));
const list = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent('to:ava@kinroot.local subject:"Reset"'))).json();
const m = await (await fetch("http://127.0.0.1:54324/api/v1/message/" + list.messages[0].ID)).json();
const link = m.HTML.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&");
await p.goto(link); await p.waitForURL(/update-password/); await p.fill("#password", "family-pass-2"); await p.fill("#confirm", "family-pass-2"); await p.click("button[type=submit]"); await p.waitForURL(base + "/");
console.log("reset ok:", await p.locator("h1").textContent());
await ctx.close();
await signIn(b, "ava@kinroot.local", "family-pass-2").then(() => console.log("ava signs in with new password"));
// Deactivate uncle
const admin = await signIn(b, "admin@kinroot.local", "kinroot-admin-1");
const uncle = await signIn(b, "uncle@kinroot.local", "family-pass-1");
await admin.goto(base + "/family"); admin.once("dialog", (d) => d.accept());
await admin.locator("tr:has-text('Uncle Ray') button:has-text('Deactivate')").click(); await admin.waitForSelector("text=Member deactivated");
const r = await uncle.goto(base + "/"); console.log("uncle after deactivate lands on:", uncle.url().replace(base, ""));
const c2 = await b.newContext(); const p2 = await c2.newPage(); await p2.goto(base + "/login"); await p2.fill("#email", "uncle@kinroot.local"); await p2.fill("#password", "family-pass-1"); await p2.click("button[type=submit]");
await p2.waitForTimeout(1500); console.log("uncle sign-in:", await p2.locator("p[role=alert]").textContent());
await admin.locator("tr:has-text('Uncle Ray') button:has-text('Reactivate')").click(); await admin.waitForSelector("text=Member reactivated");
await signIn(b, "uncle@kinroot.local", "family-pass-1").then(() => console.log("uncle back in"));
// Signed-out visitor sees only sign in
const c3 = await b.newContext(); const p3 = await c3.newPage(); for (const u of ["/", "/vault", "/family"]) { await p3.goto(base + u); console.log("anon", u, "->", p3.url().replace(base, "")); }
// Phone width
const c4 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p4 = await c4.newPage();
await p4.goto(base + "/login"); await p4.fill("#email", "admin@kinroot.local"); await p4.fill("#password", "kinroot-admin-1"); await p4.click("button[type=submit]"); await p4.waitForURL(base + "/");
await p4.screenshot({ path: "e2e/out/phone-home.png", fullPage: true }); await p4.click("text=Menu"); await p4.screenshot({ path: "e2e/out/phone-menu.png" });
await b.close();
