"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db";
import { signIn, signOut } from "@/lib/session";

export type LoginState = { error: string | null; email: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const { id, error } = await signIn(email, password);
  if (error === "USER_DISABLED") return { error: "This account doesn't have access. Ask a family admin.", email };
  if (error === "TOO_MANY_ATTEMPTS_TRY_LATER") return { error: "Too many tries. Wait a few minutes, or reset your password.", email };
  if (error || !id) return { error: "That email and password did not match.", email };
  const { data: profile } = await createAdminClient().from("profiles").select("active").eq("id", id).maybeSingle();
  if (!profile?.active) {
    await signOut();
    return { error: "This account doesn't have access. Ask a family admin.", email };
  }
  redirect("/");
}
