import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Back to the page with a one-line message the page shows through <Flash>. */
export function back(path: string, msg: { error?: string; ok?: string } = {}): never {
  revalidatePath("/", "layout");
  const q = new URLSearchParams();
  if (msg.error) q.set("error", msg.error);
  if (msg.ok) q.set("ok", msg.ok);
  const s = q.toString();
  redirect(s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path);
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const optStr = (f: FormData, k: string) => str(f, k) || null;
export const ids = (f: FormData, k = "circle_ids") => f.getAll(k).map(String).filter(Boolean);
