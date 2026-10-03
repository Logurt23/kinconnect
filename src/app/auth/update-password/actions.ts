"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db";
import { checkPasswordCode, setPasswordWithCode, signIn } from "@/lib/session";

export async function updatePassword(_: { error: string | null }, form: FormData) {
  const password = String(form.get("password") ?? "");
  const code = String(form.get("code") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== form.get("confirm")) return { error: "The two passwords don't match." };
  const db = createAdminClient();
  const pending = await checkPasswordCode(code);
  const { data: profile } = pending ? await db.from("profiles").select("id").eq("email", pending.toLowerCase()).maybeSingle() : { data: null };
  if (!profile) return { error: "This link has expired or was already used. Ask for a new one." };
  const { email, error } = await setPasswordWithCode(code, password);
  if (error === "WEAK_PASSWORD") return { error: "Choose a longer password." };
  if (error || !email) return { error: "This link has expired or was already used. Ask for a new one." };
  // An invite has been accepted once its link is used, so it's no longer pending.
  await db.from("invites").delete().eq("email", email.toLowerCase());
  const signedIn = await signIn(email, password);
  redirect(signedIn.error ? "/login" : "/");
}
