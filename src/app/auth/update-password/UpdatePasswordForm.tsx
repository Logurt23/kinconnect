"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { updatePassword } from "./actions";

export function UpdatePasswordForm({ code }: { code: string }) {
  const [state, action] = useActionState(updatePassword, { error: null as string | null });
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="code" value={code} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{state.error}</p>}
      <ConfirmSubmit className="btn-primary w-full py-2.5" pending="Saving...">Save password</ConfirmSubmit>
    </form>
  );
}
