"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; email: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "That email and password did not match.", email };
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have access. Ask a family admin.", email };
  }
  redirect("/");
}
