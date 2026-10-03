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
export const authEmulator = "http://127.0.0.1:9099/emulator/v1/projects/demo-kinconnect";
/** The newest "set your password" link the Auth emulator would have emailed, pointed at our action URL. */
export async function inviteLink(email, after = 0) {
  for (let i = 0; i < 20; i++) {
    const { oobCodes = [] } = await (await fetch(authEmulator + "/oobCodes")).json();
    const mine = oobCodes.filter((c) => c.email === email && c.requestType === "PASSWORD_RESET");
    if (mine.length > after) return `${base}/auth/action?mode=resetPassword&oobCode=${mine.at(-1).oobCode}`;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no mail for " + email);
}
export async function mailCount(email) {
  const { oobCodes = [] } = await (await fetch(authEmulator + "/oobCodes")).json();
  return oobCodes.filter((c) => c.email === email).length;
}
export async function flash(page) {
  return (await page.locator("[role=alert], .bg-green-50").first().textContent({ timeout: 5000 }).catch(() => null));
}
