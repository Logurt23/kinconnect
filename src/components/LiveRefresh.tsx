"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when an alert opens, closes or gets an update. RLS decides which rows this
 * member's socket receives, so nobody is told about alerts outside their circles.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("family-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => router.refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alert_updates" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
