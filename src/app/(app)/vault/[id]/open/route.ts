import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Opens a vault file through a 60-second signed link, made at the moment of the click. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("vault_items").select("path").eq("id", id).maybeSingle();
  if (!item) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("vault").createSignedUrl(item.path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
