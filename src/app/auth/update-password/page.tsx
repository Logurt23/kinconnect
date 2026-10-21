import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createAdminClient } from "@/lib/db";
import { checkPasswordCode } from "@/lib/session";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata = { title: "Set password" };

/** Invite and reset links land here (through /auth/action) with the emailed code. */
export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const email = code ? await checkPasswordCode(code) : null;
  // A canceled invite's profile is gone, so its link is dead even if the code itself would still work.
  const { data: profile } = email ? await createAdminClient().from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle() : { data: null };
  if (!code || !email || !profile) redirect(`/auth/error?error=${encodeURIComponent("This link has expired or was already used.")}`);
  return (
    <AuthCard subtitle={`Choose a password for ${email}.`}>
      <UpdatePasswordForm code={code} />
    </AuthCard>
  );
}
