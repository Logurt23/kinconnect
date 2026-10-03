import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { AREAS, serveFile, type Area } from "@/lib/storage";

/** A private file, streamed to members the database says may read it (their own folder, or can_read_object). */
export async function GET(_: NextRequest, { params }: { params: Promise<{ area: string; path: string[] }> }) {
  const { area, path: parts } = await params;
  const path = parts.join("/");
  const user = await currentUser();
  if (!user || !AREAS.includes(area as Area) || parts.some((p) => p === ".." || p === ".")) return new NextResponse("Not found", { status: 404 });
  if (!path.startsWith(`${user.id}/`)) {
    const { data } = await (await createClient()).rpc("can_read_object", { bucket: area, object_name: path });
    if (data !== true) return new NextResponse("Not found", { status: 404 });
  }
  return serveFile(area as Area, path);
}
