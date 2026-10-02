"use server";

import { requireMember } from "@/lib/auth";
import { back, optStr, str } from "@/lib/actions";
import { MAX_UPLOAD, safeName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const P = "/settings";

export async function saveProfile(f: FormData) {
  const me = await requireMember();
  const lat = str(f, "lat") ? Number(str(f, "lat")) : null;
  const lon = str(f, "lon") ? Number(str(f, "lon")) : null;
  if ((lat == null) !== (lon == null) || (lat != null && (Math.abs(lat) > 90 || Math.abs(lon!) > 180 || Number.isNaN(lat) || Number.isNaN(lon))))
    back(P, { error: "Enter both latitude and longitude, or neither." });
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    display_name: str(f, "display_name") || me.display_name, birthday: optStr(f, "birthday"),
    home_label: optStr(f, "home_label"), lat, lon,
  };
  const photo = f.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/") || photo.size > MAX_UPLOAD) back(P, { error: "Photos must be images under 20 MB." });
    const path = `${me.id}/${Date.now()}-${safeName(photo.name)}`;
    const up = await supabase.storage.from("avatars").upload(path, photo, { contentType: photo.type });
    if (up.error) back(P, { error: up.error.message });
    if (me.photo_path) await supabase.storage.from("avatars").remove([me.photo_path]);
    update.photo_path = path;
  }
  const { error } = await supabase.from("profiles").update(update).eq("id", me.id);
  back(P, error ? { error: error.message } : { ok: "Saved." });
}

export async function changePassword(f: FormData) {
  await requireMember();
  const password = str(f, "password");
  if (password.length < 8) back(P, { error: "Use at least 8 characters." });
  if (password !== str(f, "confirm")) back(P, { error: "The two passwords don't match." });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  back(P, error ? { error: error.message } : { ok: "Password changed." });
}
