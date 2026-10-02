import { Sprout } from "lucide-react";

export function Wordmark({ dark = false, size = "md" }: { dark?: boolean; size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${size === "lg" ? "text-2xl" : "text-lg"} ${dark ? "text-white" : "text-ink"}`}>
      <span className={`flex items-center justify-center rounded-lg bg-brand text-white ${size === "lg" ? "h-9 w-9" : "h-7 w-7"}`}>
        <Sprout size={size === "lg" ? 20 : 16} strokeWidth={2.4} />
      </span>
      Kinroot
    </span>
  );
}
