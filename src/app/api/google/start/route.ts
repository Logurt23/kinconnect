import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { GOOGLE_SCOPE, googleConfigured, googleRedirect } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

/** Read-only Google Calendar consent, on the server. Nothing is ever written back to Google. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  if (!data.user) return NextResponse.redirect(`${site}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${site}/schedule?error=${encodeURIComponent("Google isn't set up on this site yet.")}`);
  const state = randomBytes(16).toString("hex");
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: googleRedirect(), response_type: "code",
    scope: GOOGLE_SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  res.cookies.set("kc_google_state", state, { httpOnly: true, secure: site.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/api/google" });
  return res;
}
