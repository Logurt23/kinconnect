import { browser, signIn, inviteLink, flash, base } from "./lib.mjs";
const b = await browser();
const admin = await signIn(b, "admin@kinconnect.local", "kinconnect-admin-1");
for (const [email, name, extended] of [["ava@kinconnect.local", "Ava", false], ["uncle@kinconnect.local", "Uncle Ray", true]]) {
  await admin.goto(base + "/family");
  await admin.fill("#email", email);
  await admin.fill("#display_name", name);
  if (extended) {
    // untick Core, tick Extended
    const boxes = admin.locator("form:has(#email) input[name=circle_ids]");
    await boxes.nth(0).uncheck(); await boxes.nth(1).check();
  }
  await admin.click("text=Send invite");
  await admin.waitForLoadState("networkidle");
  console.log("invite", email, await flash(admin));
  const link = await inviteLink(email);
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(link);
  await p.waitForURL(/update-password/);
  await p.fill("#password", "family-pass-1"); await p.fill("#confirm", "family-pass-1");
  await p.click("button[type=submit]");
  await p.waitForURL(base + "/");
  console.log("accepted", email, await p.locator("h1").textContent());
  await ctx.close();
}
for (const e of ["ava@kinconnect.local", "uncle@kinconnect.local"]) {
  const p = await signIn(b, e, "family-pass-1");
  console.log("signed in", e, await p.locator("aside").first().innerText().then((t) => t.split("\n").slice(-2).join(" | ")));
}
// A pending invite is listed until it's used, and canceling it kills the emailed link.
await admin.goto(base + "/family");
await admin.fill("#email", "cancelme@kinconnect.local");
await admin.click("text=Send invite");
await admin.waitForURL(/ok=Invite/);
const pendingLink = await inviteLink("cancelme@kinconnect.local");
console.log("pending listed", await admin.locator("li:has-text('cancelme@kinconnect.local') >> button:text-is('Cancel')").count() === 1);
console.log("accepted not listed", await admin.locator("li:has-text('ava@kinconnect.local') >> button:text-is('Cancel')").count() === 0);
admin.once("dialog", (d) => d.accept());
await admin.click("li:has-text('cancelme@kinconnect.local') >> button:text-is('Cancel')");
await admin.waitForURL(/canceled/);
console.log("cancel", await flash(admin));
const ctxC = await b.newContext(); const pc = await ctxC.newPage();
await pc.goto(pendingLink);
console.log("canceled link refused", /auth\/error/.test(pc.url()));
await ctxC.close();
await admin.goto(base + "/family");
await admin.screenshot({ path: "e2e/out/family.png", fullPage: true });
await b.close();
