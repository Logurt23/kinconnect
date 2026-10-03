// Screenshots of every screen at phone and desktop width, for design review. Run after the other tests.
import { browser, base } from "./lib.mjs";
const b = await browser();
const routes = ["/", "/alerts", "/resources", "/requests", "/polls", "/schedule", "/dates", "/lists", "/ledger", "/weather", "/vault", "/family", "/settings"];
for (const [tag, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1360, height: 900 }]]) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: tag === "phone" ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(base + "/login");
  await p.screenshot({ path: `e2e/out/${tag}-login.png` });
  await p.fill("#email", "admin@kinconnect.local"); await p.fill("#password", "kinconnect-admin-1"); await p.click("button[type=submit]"); await p.waitForURL(base + "/");
  for (const r of routes) {
    await p.goto(base + r);
    await p.screenshot({ path: `e2e/out/${tag}-${r === "/" ? "home" : r.slice(1)}.png`, fullPage: true });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 0) console.log(`${tag} ${r} scrolls sideways by ${wide}px`);
  }
  if (tag === "phone") { await p.click('nav button:has-text("More")'); await p.waitForTimeout(400); await p.screenshot({ path: "e2e/out/phone-more.png" }); }
  await ctx.close();
}
await b.close();
