import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends visitors without a session cookie to /login. The cookie is verified (and the member's profile
 * checked) by requireMember and the route handlers, so this is only the cheap first gate.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const open = pathname === "/login" || pathname.startsWith("/auth") || pathname.startsWith("/api/cron");
  if (open || request.cookies.has("kc_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything but static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
