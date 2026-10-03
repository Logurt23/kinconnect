"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the page when an alert opens, closes or gets an update. Polls /api/live every 10 seconds
 * while the tab is visible; RLS decides what goes into the fingerprint, so nobody is told about alerts
 * outside their circles.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let stopped = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const { stamp } = (await res.json()) as { stamp: string | null };
        if (stopped || !stamp) return;
        if (last !== null && stamp !== last) router.refresh();
        last = stamp;
      } catch {
        // Offline or signed out; try again next tick.
      }
    };
    check();
    const timer = setInterval(check, 10000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);
  return null;
}
