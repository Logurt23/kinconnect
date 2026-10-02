import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Reset password" };

async function sendReset(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim();
  const supabase = await createClient();
  // The email template links to /auth/confirm with a token hash; the same answer either way so
  // nobody can probe which emails have accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });
  redirect("/auth/forgot-password?sent=1");
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <AuthCard subtitle="We'll email you a link to choose a new password.">
      {sent ? (
        <p className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-brand">
          If that email belongs to a family member, a reset link is on its way.
        </p>
      ) : (
        <form action={sendReset} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <ConfirmSubmit className="btn-primary w-full py-2.5" pending="Sending...">Send reset link</ConfirmSubmit>
        </form>
      )}
      <Link href="/login" className="mt-4 block text-center text-xs font-semibold text-brand hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
