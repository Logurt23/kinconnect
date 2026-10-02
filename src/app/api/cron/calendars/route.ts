import { NextResponse, type NextRequest } from "next/server";
import { syncSource } from "@/lib/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/** Re-reads every Google and ICS source. Call with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: sources } = await db.from("calendar_sources").select("id, owner_id, kind, ics_url, google_calendar_id").neq("kind", "manual");
  for (const s of sources ?? []) await syncSource(db, s);
  return NextResponse.json({ synced: sources?.length ?? 0 });
}
