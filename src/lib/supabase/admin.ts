import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-key client. Bypasses RLS: only for admin actions, token storage and the weather sweep. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
