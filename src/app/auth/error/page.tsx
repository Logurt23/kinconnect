import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export default async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthCard subtitle="That link didn't work.">
      <p className="mt-6 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
        {error ?? "The link may have expired or already been used."} Ask an admin to resend your invite, or request a new reset link.
      </p>
      <Link href="/login" className="mt-4 block text-center text-xs font-semibold text-brand hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
