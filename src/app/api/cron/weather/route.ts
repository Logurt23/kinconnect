import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron, eachLimited } from "@/lib/cron";
import { createAdminClient } from "@/lib/db";
import { recordPrompts } from "@/lib/weather";

export const maxDuration = 60;

/** Sweeps every located member. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this). */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data: people } = await db.from("profiles").select("id, lat, lon").eq("active", true).not("lat", "is", null).not("lon", "is", null);
  const { done, failed } = await eachLimited(people ?? [], 5, (p) => recordPrompts(db, p.id, p.lat!, p.lon!));
  return NextResponse.json({ checked: done, failed });
}
