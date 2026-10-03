"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { toCents } from "@/lib/format";
import { createClient } from "@/lib/db";

export async function createList(f: FormData) {
  const me = await requireMember();
  const kind = (["christmas", "birthday", "other"] as const).find((k) => k === str(f, "kind")) ?? "other";
  const circles = ids(f);
  if (!circles.length) back("/lists", { error: "Pick who can see it." });
  const db = await createClient();
  const { data, error } = await db.from("gift_lists").insert({
    owner_id: me.id, kind, title: str(f, "title") || `${me.display_name}'s ${kind} list`, circle_ids: circles,
  }).select("id").single();
  if (error) back("/lists", { error: error.message });
  back(`/lists/${data.id}`);
}

/** A pasted URL is enough: the title falls back to the link's site and path. No store API. */
function titleFromUrl(url: string) {
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter((s) => s && !/^(dp|gp|product|p|item)$/i.test(s) && !/^[A-Z0-9]{10}$/.test(s))[0];
    return slug ? decodeURIComponent(slug).replace(/[-_]+/g, " ").slice(0, 80) : u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function addItem(f: FormData) {
  await requireMember();
  const list = str(f, "list_id");
  const url = optStr(f, "url");
  if (url && !/^https?:\/\//i.test(url)) back(`/lists/${list}`, { error: "Links must start with http:// or https://" });
  const title = str(f, "title") || (url ? titleFromUrl(url) : "");
  if (!title) back(`/lists/${list}`, { error: "Add a title or a link." });
  const db = await createClient();
  const { error } = await db.from("gift_items").insert({
    list_id: list, title, url, note: optStr(f, "note"), price_guess_cents: toCents(f.get("price")),
  });
  back(`/lists/${list}`, error ? { error: error.message } : {});
}

export async function removeItem(f: FormData) {
  await requireMember();
  const db = await createClient();
  await db.from("gift_items").delete().eq("id", str(f, "id"));
  back(`/lists/${str(f, "list_id")}`);
}

export async function toggleClaim(f: FormData) {
  const me = await requireMember();
  const item = str(f, "item_id");
  const list = str(f, "list_id");
  const db = await createClient();
  const { error } = str(f, "claim") === "1"
    ? await db.from("gift_claims").insert({ item_id: item, claimed_by: me.id })
    : await db.from("gift_claims").delete().eq("item_id", item).eq("claimed_by", me.id);
  back(`/lists/${list}`, error ? { error: error.code === "23505" ? "Someone already claimed that." : error.message } : {});
}

export async function deleteList(f: FormData) {
  await requireMember();
  const db = await createClient();
  await db.from("gift_lists").delete().eq("id", str(f, "list_id"));
  back("/lists", { ok: "List deleted." });
}
