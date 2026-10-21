import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db";
import { serveFile } from "@/lib/storage";

/** Opens a vault file for its owner or someone it's shared with; RLS on vault_items decides. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: item } = await (await createClient()).from("vault_items").select("path").eq("id", id).maybeSingle();
  if (!item) return new NextResponse("Not found", { status: 404 });
  const res = await serveFile("vault", item.path);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
