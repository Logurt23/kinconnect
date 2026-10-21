import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  // A deactivated member may still hold a cookie; requireMember sends them here with error=inactive.
  if (error !== "inactive" && (await currentUser())) redirect("/");
  return (
    <AuthCard subtitle="Sign in to your family's private space.">
      <LoginForm initialError={error === "inactive" ? "This account doesn't have access. Ask a family admin." : null} />
    </AuthCard>
  );
}
