import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * The action URL in Identity Platform's email templates. Invite and reset emails both arrive as
 * mode=resetPassword; the code is checked on the next page, which asks for the new password.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const code = q.get("oobCode");
  if (q.get("mode") === "resetPassword" && code) redirect(`/auth/update-password?code=${encodeURIComponent(code)}`);
  redirect(`/auth/error?error=${encodeURIComponent("That link isn't one KinConnect sends.")}`);
}
