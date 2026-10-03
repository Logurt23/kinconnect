"use server";

import { requireMember } from "@/lib/auth";
import { back, optStr, str } from "@/lib/actions";
import { toCents } from "@/lib/format";
import { createClient } from "@/lib/db";

const P = "/ledger";

export async function addEntry(f: FormData) {
  const me = await requireMember();
  const kind = (["request", "offer", "iou"] as const).find((k) => k === str(f, "kind")) ?? "request";
  const other = str(f, "other_id");
  const amount = toCents(f.get("amount"));
  if (!other || other === me.id) back(P, { error: "Pick another family member." });
  if (!amount) back(P, { error: "Enter an amount." });
  // A request means they pay me; an offer or an IOU means I pay them.
  const [from_id, to_id] = kind === "request" ? [other, me.id] : [me.id, other];
  const db = await createClient();
  const { error } = await db.from("ledger_entries").insert({ kind, amount_cents: amount, note: optStr(f, "note"), from_id, to_id, created_by: me.id });
  back(P, error ? { error: error.message } : { ok: "Added." });
}

export async function markPaid(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.rpc("mark_ledger_paid", { e: str(f, "id"), paid: str(f, "paid") === "1" });
  back(P, error ? { error: error.message } : {});
}

export async function cancelEntry(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.rpc("cancel_ledger_entry", { e: str(f, "id") });
  back(P, error ? { error: error.message } : {});
}
