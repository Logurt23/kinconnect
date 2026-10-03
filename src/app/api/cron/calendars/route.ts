import { NextResponse, type NextRequest } from "next/server";
import { syncSource } from "@/lib/calendar";
import { authorizeCron, eachLimited } from "@/lib/cron";
import { createAdminClient } from "@/lib/db";

export const maxDuration = 60;

/** Re-reads every Google and ICS source. Call with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data: sources } = await db.from("calendar_sources").select("id, owner_id, kind, ics_url, google_calendar_id").neq("kind", "manual");
  const { done, failed } = await eachLimited(sources ?? [], 5, (s) => syncSource(db, s));
  return NextResponse.json({ synced: done, failed });
}
