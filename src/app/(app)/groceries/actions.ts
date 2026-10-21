"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/db";

const P = "/groceries";
const at = (f: FormData) => `${P}#list-${str(f, "list_id")}`;

export async function startList(f: FormData) {
  const me = await requireMember();
  const title = str(f, "title").slice(0, 80) || "Groceries";
  const circles = ids(f);
  if (!circles.length) back(P, { error: "Pick who adds to the list." });
  const shopOn = /^\d{4}-\d{2}-\d{2}$/.test(str(f, "shop_on")) ? str(f, "shop_on") : null;
  const db = await createClient();
  const { error } = await db.from("grocery_lists").insert({ owner_id: me.id, title, shop_on: shopOn, circle_ids: circles });
  back(P, error ? { error: error.message } : { ok: `${title} is open. Everyone you sent it to can add what they want.` });
}

export async function addItem(f: FormData) {
  const me = await requireMember();
  const name = str(f, "name").slice(0, 80);
  if (!name) back(at(f), { error: "Type what you want." });
  const db = await createClient();
  const { error } = await db.from("grocery_items").insert({
    list_id: str(f, "list_id"), name, qty: optStr(f, "qty")?.slice(0, 30) ?? null, note: optStr(f, "note")?.slice(0, 140) ?? null, added_by: me.id,
  });
  back(at(f), error ? { error: error.message.includes("row-level security") ? "That list is done; start a new one." : error.message } : { ok: `Added ${name}.` });
}

/** Got it / not yet. The database stamps who checked it and when. */
export async function toggleItem(f: FormData) {
  await requireMember();
  const got = str(f, "got") === "1";
  const db = await createClient();
  const { error } = await db.from("grocery_items").update({ checked_at: got ? new Date().toISOString() : null }).eq("id", str(f, "item_id"));
  back(at(f), error ? { error: error.message } : {});
}

export async function removeItem(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("grocery_items").delete().eq("id", str(f, "item_id"));
  back(at(f), error ? { error: error.message } : { ok: "Removed." });
}

export async function clearChecked(f: FormData) {
  await requireMember();
  const db = await createClient();
  // RLS lets the list's owner delete any item; for anyone else this only removes their own.
  const { error } = await db.from("grocery_items").delete().eq("list_id", str(f, "list_id")).not("checked_at", "is", null);
  back(at(f), error ? { error: error.message } : { ok: "Cleared what's been bought." });
}

export async function setListDone(f: FormData) {
  await requireMember();
  const done = str(f, "done") === "1";
  const db = await createClient();
  const { error } = await db.from("grocery_lists").update({ closed_at: done ? new Date().toISOString() : null }).eq("id", str(f, "list_id"));
  back(at(f), error ? { error: error.message } : { ok: done ? "Marked done. Nobody can add to it now." : "Reopened." });
}

export async function deleteList(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("grocery_lists").delete().eq("id", str(f, "list_id"));
  back(P, error ? { error: error.message } : { ok: "List deleted." });
}
