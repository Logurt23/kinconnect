import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Alerts sent to me by someone else that I haven't opened. */
export async function unreadAlertCount(userId: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const [{ data: alerts }, { data: receipts }] = await Promise.all([
    supabase.from("alerts").select("id").neq("sender_id", userId).gte("opened_at", since),
    supabase.from("alert_receipts").select("alert_id").eq("user_id", userId),
  ]);
  const read = new Set((receipts ?? []).map((r) => r.alert_id));
  return (alerts ?? []).filter((a) => !read.has(a.id)).length;
}
