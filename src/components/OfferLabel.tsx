import { money } from "@/lib/format";

export function offerLabel(l: { offer_type: string; price_cents: number | null; loan_days: number | null }) {
  if (l.offer_type === "sell") return `For sale · ${money(l.price_cents)}`;
  if (l.offer_type === "loan") return `Loan · ${l.loan_days} days`;
  return "Free to a good home";
}
