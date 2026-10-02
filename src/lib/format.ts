export function money(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCents(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function dateLabel(d: string | Date, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  return date.toLocaleDateString("en-US", opts);
}

export function dateTimeLabel(d: string | Date) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ago(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Next birthday on or after today, and how many days away. */
export function nextBirthday(birthday: string, today = new Date()) {
  const [, m, d] = birthday.split("-").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(start.getFullYear(), m - 1, d);
  if (next < start) next = new Date(start.getFullYear() + 1, m - 1, d);
  const days = Math.round((next.getTime() - start.getTime()) / 86400000);
  return { date: next, days };
}
