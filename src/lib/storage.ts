import "server-only";
import { createClient } from "@/lib/supabase/server";

export const MAX_UPLOAD = 20 * 1024 * 1024;

/** Short-lived links to private files. RLS on storage.objects decides who gets one. */
export async function signedUrls(bucket: string, paths: string[], seconds = 60) {
  if (!paths.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds);
  const map = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

export function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "file";
}
