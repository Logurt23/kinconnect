"use server";

import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { back, str } from "@/lib/actions";
import { IMAGE_TYPES, MAX_UPLOAD, putFile, removeFiles, safeName, sniffType } from "@/lib/storage";
import { createClient } from "@/lib/db";

const P = "/vault";
const OK_TYPES = [...IMAGE_TYPES, "application/pdf"];

export async function upload(f: FormData) {
  const me = await requireMember();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) back(P, { error: "Choose a file." });
  if (file.size > MAX_UPLOAD) back(P, { error: "Files must be under 20 MB." });
  const type = await sniffType(file);
  if (!type || !OK_TYPES.includes(type)) back(P, { error: "Upload an image or a PDF." });
  const db = await createClient();
  const path = `${me.id}/${randomUUID()}-${safeName(file.name)}`;
  const upError = await putFile("vault", path, file, type!);
  if (upError) back(P, { error: upError });
  const { error } = await db.from("vault_items").insert({
    owner_id: me.id, title: str(f, "title") || file.name, path, mime: type, size_bytes: file.size,
  });
  if (error) {
    await removeFiles("vault", [path]);
    back(P, { error: error.message });
  }
  back(P, { ok: "Uploaded. Only you can see it until you share it." });
}

export async function share(f: FormData) {
  await requireMember();
  const target = str(f, "target"); // "user:<id>" or "circle:<id>"
  const [kind, id] = target.split(":");
  if (!id || !["user", "circle"].includes(kind)) back(P, { error: "Pick a person or a circle." });
  const db = await createClient();
  const { error } = await db.from("vault_shares").insert({
    item_id: str(f, "item_id"), user_id: kind === "user" ? id : null, circle_id: kind === "circle" ? id : null,
  });
  back(P, error ? { error: error.message } : { ok: "Shared." });
}

export async function unshare(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("vault_shares").delete().eq("id", str(f, "share_id"));
  back(P, error ? { error: error.message } : { ok: "Access removed." });
}

export async function remove(f: FormData) {
  const me = await requireMember();
  const db = await createClient();
  // Shared items are readable too, so only delete what's mine.
  const { data } = await db.from("vault_items").select("path").eq("id", str(f, "item_id")).eq("owner_id", me.id).maybeSingle();
  if (data) {
    await db.from("vault_items").delete().eq("id", str(f, "item_id"));
    await removeFiles("vault", [data.path]);
  }
  back(P, { ok: "Deleted." });
}
