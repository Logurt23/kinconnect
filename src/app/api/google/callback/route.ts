import { NextResponse, type NextRequest } from "next/server";
import { googleConfigured, googleRedirect, personColor, syncSource } from "@/lib/calendar";
import { encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const fail = (msg: string) => NextResponse.redirect(`${site}/schedule?error=${encodeURIComponent(msg)}`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${site}/login`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!googleConfigured() || !code || !state || state !== req.cookies.get("kc_google_state")?.value) return fail("Google sign-in didn't complete. Try again.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirect(), grant_type: "authorization_code",
    }),
  });
  const token = await res.json();
  if (!res.ok || !token.refresh_token) return fail(token.error_description || "Google didn't return a lasting connection. Try again.");

  const db = createAdminClient();
  await db.from("google_tokens").upsert({ user_id: auth.user.id, refresh_token_enc: encrypt(token.refresh_token), scope: token.scope, updated_at: new Date().toISOString() });
  // Same default as everything else: Core if they're in it, else their first circle. Busy only.
  const { data: mine } = await supabase.from("circle_members").select("circle_id, circles(kind)").eq("user_id", auth.user.id);
  const core = (mine ?? []).find((m) => (m.circles as unknown as { kind: string } | null)?.kind === "core") ?? mine?.[0];
  const { data: existing } = await supabase.from("calendar_sources").select("id").eq("kind", "google").eq("google_calendar_id", "primary").maybeSingle();
  const { data: source } = existing ? { data: existing } : await supabase.from("calendar_sources").insert({
    owner_id: auth.user.id, kind: "google", label: "Google Calendar", google_calendar_id: "primary", color: personColor(auth.user.id), circle_ids: core ? [core.circle_id] : [],
  }).select("id").single();
  if (source) await syncSource(supabase, { id: source.id, owner_id: auth.user.id, kind: "google", ics_url: null, google_calendar_id: "primary" });

  const out = NextResponse.redirect(`${site}/schedule?ok=${encodeURIComponent("Google Calendar connected, read only. Choose who sees it below.")}`);
  out.cookies.delete({ name: "kc_google_state", path: "/api/google" });
  return out;
}
