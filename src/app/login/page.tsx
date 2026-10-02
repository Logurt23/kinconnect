import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && error !== "inactive") redirect("/");
  if (data.user && error === "inactive") await supabase.auth.signOut();
  return (
    <AuthCard subtitle="Sign in to your family's private space.">
      <LoginForm initialError={error === "inactive" ? "This account doesn't have access. Ask a family admin." : null} />
    </AuthCard>
  );
}
