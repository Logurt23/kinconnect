"use server";

import { requireMember } from "@/lib/auth";
import { back, optStr, str } from "@/lib/actions";
import { IMAGE_TYPES, MAX_UPLOAD, putFile, removeFiles, safeName, sniffType } from "@/lib/storage";
import { auth } from "@/lib/session";
import { createClient } from "@/lib/db";

const P = "/settings";

export async function saveProfile(f: FormData) {
  const me = await requireMember();
  const lat = str(f, "lat") ? Number(str(f, "lat")) : null;
  const lon = str(f, "lon") ? Number(str(f, "lon")) : null;
  if ((lat == null) !== (lon == null) || (lat != null && (Math.abs(lat) > 90 || Math.abs(lon!) > 180 || Number.isNaN(lat) || Number.isNaN(lon))))
    back(P, { error: "Enter both latitude and longitude, or neither." });
  const db = await createClient();
  const update: Record<string, unknown> = {
    display_name: str(f, "display_name") || me.display_name, birthday: optStr(f, "birthday"),
    home_label: optStr(f, "home_label"), lat, lon,
  };
  const photo = f.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const type = photo.size <= MAX_UPLOAD ? await sniffType(photo) : null;
    if (!type || !IMAGE_TYPES.includes(type)) back(P, { error: "Photos must be images under 20 MB." });
    const path = `${me.id}/${Date.now()}-${safeName(photo.name)}`;
    const upError = await putFile("avatars", path, photo, type!);
    if (upError) back(P, { error: upError });
    if (me.photo_path) await removeFiles("avatars", [me.photo_path]);
    update.photo_path = path;
  }
  const { error } = await db.from("profiles").update(update).eq("id", me.id);
  back(P, error ? { error: error.message } : { ok: "Saved." });
}

export async function changePassword(f: FormData) {
  const me = await requireMember();
  const password = str(f, "password");
  if (password.length < 8) back(P, { error: "Use at least 8 characters." });
  if (password !== str(f, "confirm")) back(P, { error: "The two passwords don't match." });
  const error = await auth().updateUser(me.id, { password }).then(() => null, (e: Error) => e.message);
  back(P, error ? { error } : { ok: "Password changed." });
}
