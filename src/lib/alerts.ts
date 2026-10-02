import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Alerts sent to me by someone else in the last 60 days that I haven't opened (counted in SQL). */
export async function unreadAlertCount() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_alert_count");
  return typeof data === "number" ? data : 0;
}
