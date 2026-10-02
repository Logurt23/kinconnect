import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata = { title: "Set password" };

/** Invite and reset links land here after /auth/confirm has started a session. */
export default async function UpdatePassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return (
    <AuthCard subtitle={`Choose a password for ${data.user.email}.`}>
      <UpdatePasswordForm />
    </AuthCard>
  );
}
