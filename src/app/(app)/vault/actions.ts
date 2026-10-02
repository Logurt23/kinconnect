"use server";

import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { back, str } from "@/lib/actions";
import { MAX_UPLOAD, safeName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const P = "/vault";
const OK_TYPES = /^(image\/(png|jpeg|gif|webp|heic|heif)|application\/pdf)$/;

export async function upload(f: FormData) {
  const me = await requireMember();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) back(P, { error: "Choose a file." });
  if (!OK_TYPES.test(file.type)) back(P, { error: "Upload an image or a PDF." });
  if (file.size > MAX_UPLOAD) back(P, { error: "Files must be under 20 MB." });
  const supabase = await createClient();
  const path = `${me.id}/${randomUUID()}-${safeName(file.name)}`;
  const up = await supabase.storage.from("vault").upload(path, file, { contentType: file.type });
  if (up.error) back(P, { error: up.error.message });
  const { error } = await supabase.from("vault_items").insert({
    owner_id: me.id, title: str(f, "title") || file.name, path, mime: file.type, size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from("vault").remove([path]);
    back(P, { error: error.message });
  }
  back(P, { ok: "Uploaded. Only you can see it until you share it." });
}

export async function share(f: FormData) {
  await requireMember();
  const target = str(f, "target"); // "user:<id>" or "circle:<id>"
  const [kind, id] = target.split(":");
  if (!id || !["user", "circle"].includes(kind)) back(P, { error: "Pick a person or a circle." });
  const supabase = await createClient();
  const { error } = await supabase.from("vault_shares").insert({
    item_id: str(f, "item_id"), user_id: kind === "user" ? id : null, circle_id: kind === "circle" ? id : null,
  });
  back(P, error ? { error: error.message } : { ok: "Shared." });
}

export async function unshare(f: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("vault_shares").delete().eq("id", str(f, "share_id"));
  back(P, error ? { error: error.message } : { ok: "Access removed." });
}

export async function remove(f: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("vault_items").select("path").eq("id", str(f, "item_id")).single();
  if (data) {
    await supabase.storage.from("vault").remove([data.path]);
    await supabase.from("vault_items").delete().eq("id", str(f, "item_id"));
  }
  back(P, { ok: "Deleted." });
}
