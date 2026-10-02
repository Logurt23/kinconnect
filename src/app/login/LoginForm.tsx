"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, action] = useActionState(login, { error: initialError, email: "" } as LoginState);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/auth/forgot-password" className="text-xs font-semibold text-brand hover:underline">Forgot?</Link>
        </div>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{state.error}</p>
      )}
      <ConfirmSubmit className="btn-primary w-full py-2.5" pending="Signing in...">Sign in</ConfirmSubmit>
    </form>
  );
}
