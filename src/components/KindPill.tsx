import { ALERT_LABEL } from "@/lib/alerts-labels";

export function KindPill({ kind }: { kind: string }) {
  const cls = kind === "emergency_911" ? "bg-danger text-white" : kind === "emergency_family" ? "bg-warn text-white" : kind === "weather_checkin" ? "bg-amber-100 text-warn" : "bg-ink/5 text-ink";
  return <span className={`pill ${cls}`}>{ALERT_LABEL[kind]}</span>;
}
