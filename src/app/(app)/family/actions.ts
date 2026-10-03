"use server";

import { requireAdmin } from "@/lib/auth";
import { back, ids, str } from "@/lib/actions";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db";
import { auth, sendPasswordEmail } from "@/lib/session";

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
  // A sign-in account with no password yet, whose uid is a UUID like every other id here, then a profile
  // and circles from the invite, then the "set your password" email.
  const existing = await auth().getUserByEmail(email).catch(() => null);
  const uid = existing?.uid ?? (await auth().createUser({ uid: randomUUID(), email }).catch(() => null))?.uid;
  const profile = uid ? await db.rpc("create_profile_from_invite", { uid, mail: email }) : null;
  const mail = uid && !profile?.error ? await sendPasswordEmail(email) : null;
  if (!uid || profile?.error || mail?.error) {
    await db.from("invites").delete().eq("email", email);
    if (uid && !profile?.error) await db.from("profiles").delete().eq("id", uid);
    if (uid && !existing) await auth().deleteUser(uid).catch(() => {});
    back(P, { error: `Couldn't send the invite${mail?.error ? ` (${mail.error})` : ""}. Try again.` });
  }
  back(P, { ok: `Invite sent to ${email}.` });
}

export async function cancelInvite(f: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const email = str(f, "email");
  const { data: invite } = await db.from("invites").delete().eq("email", email).select("user_id").maybeSingle();
  // Remove the account that never set a password, and its profile, so the link in their inbox stops working.
  if (invite?.user_id) {
    const user = await auth().getUser(invite.user_id).catch(() => null);
    if (user && !user.providerData.some((p) => p.providerId === "password")) {
      await auth().deleteUser(invite.user_id);
      await db.from("profiles").delete().eq("id", invite.user_id);
    }
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
  // A disabled account can't sign in, and an inactive profile sees nothing; history stays in place.
  await auth().updateUser(id, { disabled: !active });
  if (!active) await auth().revokeRefreshTokens(id);
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
