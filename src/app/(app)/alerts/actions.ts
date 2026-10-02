"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["notice", "emergency_911", "emergency_family"] as const;

export async function sendAlert(f: FormData) {
  const me = await requireMember();
  const kind = KINDS.find((k) => k === str(f, "kind")) ?? "notice";
  const circles = ids(f);
  let message = str(f, "message");
  if (!message && kind === "emergency_911") message = "Emergency, call for help.";
  if (!message) back("/alerts", { error: "Write a short message." });
  if (circles.length === 0) back("/alerts", { error: "Pick who gets it." });
  const supabase = await createClient();
  const { data, error } = await supabase.from("alerts").insert({
    sender_id: me.id, kind, message: message.slice(0, 1000), circle_ids: circles,
    location_label: optStr(f, "location_label") ?? (kind === "notice" ? null : me.home_label),
    lat: kind === "notice" ? null : me.lat, lon: kind === "notice" ? null : me.lon,
  }).select("id").single();
  if (error) back("/alerts", { error: error.message });
  back(`/alerts/${data.id}`, { ok: kind === "notice" ? "Notice sent." : "Emergency sent. It stays pinned on everyone's Home until it's closed." });
}

export async function postUpdate(f: FormData) {
  const me = await requireMember();
  const id = str(f, "alert_id");
  const kind = str(f, "kind") || "note";
  const supabase = await createClient();
  const { error } = await supabase.from("alert_updates").insert({ alert_id: id, author_id: me.id, kind, body: optStr(f, "body") });
  if (error) back(`/alerts/${id}`, { error: error.message });
  // A weather check-in closes when its sender reports they're safe.
  if (kind === "safe") {
    await supabase.from("alerts").update({ closed_at: new Date().toISOString(), closed_by: me.id })
      .eq("id", id).eq("kind", "weather_checkin").eq("sender_id", me.id).is("closed_at", null);
  }
  back(`/alerts/${id}`);
}

export async function markSeen(f: FormData) {
  const me = await requireMember();
  const id = str(f, "alert_id");
  const supabase = await createClient();
  await supabase.from("alert_receipts").upsert({ alert_id: id, user_id: me.id, seen_at: new Date().toISOString() });
  back(`/alerts/${id}`);
}

export async function closeAlert(f: FormData) {
  const me = await requireMember();
  const id = str(f, "alert_id");
  const supabase = await createClient();
  const { data, error } = await supabase.from("alerts").update({ closed_at: new Date().toISOString(), closed_by: me.id })
    .eq("id", id).is("closed_at", null).select("id");
  if (error || !data?.length) back(`/alerts/${id}`, { error: "Only the sender or an admin can close this." });
  await supabase.from("alert_updates").insert({ alert_id: id, author_id: me.id, kind: "resolved", body: "Closed" });
  // A weather check-in that closes counts as answered.
  back(`/alerts/${id}`, { ok: "Closed." });
}
