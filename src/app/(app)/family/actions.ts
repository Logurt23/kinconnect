"use server";

import { requireAdmin } from "@/lib/auth";
import { back, ids, str } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";

const P = "/family";

export async function inviteMember(f: FormData) {
  const me = await requireAdmin();
  const email = str(f, "email").toLowerCase();
  const name = str(f, "display_name");
  const role = str(f, "role") === "admin" ? "admin" : "member";
  const circles = ids(f);
  if (!email.includes("@")) back(P, { error: "Enter an email address." });
  if (circles.length === 0) back(P, { error: "Pick at least one circle." });
  const db = createAdminClient();
  const { data: exists } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (exists) back(P, { error: `${email} already has an account.` });
  const { error } = await db.from("invites").upsert({ email, display_name: name || null, role, circle_ids: circles, invited_by: me.id });
  if (error) back(P, { error: error.message });
  const { error: mailError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });
  if (mailError) {
    await db.from("invites").delete().eq("email", email);
    back(P, { error: `Couldn't send the invite: ${mailError.message}` });
  }
  back(P, { ok: `Invite sent to ${email}.` });
}

export async function cancelInvite(f: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const email = str(f, "email");
  const { data: invite } = await db.from("invites").delete().eq("email", email).select("user_id").maybeSingle();
  // Remove the unconfirmed auth user too, so the link in their inbox stops working.
  if (invite?.user_id) {
    const { data } = await db.auth.admin.getUserById(invite.user_id);
    if (data.user && !data.user.last_sign_in_at) await db.auth.admin.deleteUser(invite.user_id);
  }
  back(P, { ok: "Invite canceled." });
}

export async function updateMember(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, "id");
  const role = str(f, "role") === "admin" ? "admin" : "member";
  const circles = ids(f);
  if (id === me.id && role !== "admin") back(P, { error: "You can't remove your own admin role." });
  if (circles.length === 0) back(P, { error: "Keep at least one circle, or they won't see anything." });
  const db = createAdminClient();
  await db.from("profiles").update({ role }).eq("id", id);
  await db.from("circle_members").delete().eq("user_id", id);
  await db.from("circle_members").insert(circles.map((c) => ({ circle_id: c, user_id: id })));
  back(P, { ok: "Saved." });
}

export async function setActive(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, "id");
  const active = str(f, "active") === "true";
  if (id === me.id) back(P, { error: "You can't deactivate yourself." });
  const db = createAdminClient();
  await db.from("profiles").update({ active }).eq("id", id);
  // Banning ends their sessions at the next token refresh; history stays in place.
  await db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  back(P, { ok: active ? "Member reactivated." : "Member deactivated. Their history stays." });
}

export async function addCircle(f: FormData) {
  await requireAdmin();
  const name = str(f, "name");
  if (!name) back(P, { error: "Name the circle." });
  const { error } = await createAdminClient().from("circles").insert({ name, kind: "branch", color: str(f, "color") || "#475569" });
  back(P, error ? { error: error.message } : { ok: `Circle ${name} added.` });
}

export async function addCategory(f: FormData) {
  await requireAdmin();
  const scope = str(f, "scope") === "request" ? "request" : "resource";
  const name = str(f, "name");
  if (!name) back(P, { error: "Name the category." });
  const { error } = await createAdminClient().from("categories").insert({ scope, name, sort: 100 });
  back(P, error ? { error: error.message } : { ok: "Category added." });
}

export async function renameCategory(f: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("categories").update({ name: str(f, "name") }).eq("id", str(f, "id"));
  back(P, error ? { error: error.message } : { ok: "Category renamed." });
}

export async function deleteCategory(f: FormData) {
  await requireAdmin();
  const { error } = await createAdminClient().from("categories").delete().eq("id", str(f, "id"));
  back(P, error ? { error: error.message } : { ok: "Category removed." });
}
