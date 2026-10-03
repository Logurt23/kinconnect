import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Runs `fn` over `items` a few at a time; one failure doesn't stop the rest. */
export async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>) {
  let failed = 0;
  for (let i = 0; i < items.length; i += limit) {
    const results = await Promise.allSettled(items.slice(i, i + limit).map(fn));
    failed += results.filter((r) => r.status === "rejected").length;
  }
  return { done: items.length - failed, failed };
}
