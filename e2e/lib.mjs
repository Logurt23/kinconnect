import { chromium } from "playwright";
export const base = "http://localhost:3000";
export async function browser() { return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); }
export async function signIn(b, email, password) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(base + "/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(base + "/", { timeout: 30000 });
  return page;
}
export async function inviteLink(email) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + email))).json();
    if (list.messages?.length) {
      const m = await (await fetch("http://127.0.0.1:54324/api/v1/message/" + list.messages[0].ID)).json();
      return m.HTML.match(/href="([^"]+)"/)[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no mail for " + email);
}
export async function flash(page) {
  return (await page.locator("[role=alert], .bg-green-50").first().textContent({ timeout: 5000 }).catch(() => null));
}
