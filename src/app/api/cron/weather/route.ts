import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPrompts } from "@/lib/weather";

/** Sweeps every located member. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: people } = await db.from("profiles").select("id, lat, lon").eq("active", true).not("lat", "is", null).not("lon", "is", null);
  let checked = 0;
  for (const p of people ?? []) {
    await recordPrompts(db, p.id, p.lat!, p.lon!);
    checked++;
  }
  return NextResponse.json({ checked });
}
