import { NextResponse } from "next/server";
import { createClient } from "@/lib/db";
import { currentUser } from "@/lib/session";

/** A short fingerprint of the alerts this member can see. <LiveRefresh> polls it and refreshes on change. */
export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ stamp: null }, { status: 401 });
  const { data } = await (await createClient()).rpc("live_stamp");
  return NextResponse.json({ stamp: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}
