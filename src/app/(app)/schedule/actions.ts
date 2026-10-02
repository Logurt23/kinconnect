"use server";

import { defaultCircleIds, requireMember } from "@/lib/auth";
import { back, ids, str } from "@/lib/actions";
import { normalizeIcsUrl, personColor, syncSource } from "@/lib/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const P = "/schedule";

export async function addIcs(f: FormData) {
  const me = await requireMember();
  let url: string;
  try {
    url = await normalizeIcsUrl(str(f, "ics_url"));
  } catch (e) {
    back(P, { error: e instanceof Error && e.message !== "Invalid URL" ? e.message : "That doesn't look like a calendar link." });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_sources").insert({
    owner_id: me.id, kind: "ics", label: str(f, "label") || "Apple Calendar", ics_url: url, color: personColor(me.id), circle_ids: defaultCircleIds(me),
  }).select("id, owner_id, kind, ics_url, google_calendar_id").single();
  if (error) back(P, { error: error.message });
  await syncSource(supabase, data);
  back(P, { ok: "Subscribe link added. It's busy-only until you choose to show titles." });
}

export async function addGoogleCalendar(f: FormData) {
  const me = await requireMember();
  const calId = str(f, "google_calendar_id");
  if (!calId) back(P, { error: "Enter the calendar ID from Google Calendar settings." });
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_sources").insert({
    owner_id: me.id, kind: "google", label: str(f, "label") || calId, google_calendar_id: calId, color: personColor(me.id), circle_ids: defaultCircleIds(me),
  }).select("id, owner_id, kind, ics_url, google_calendar_id").single();
  if (error) back(P, { error: error.message });
  await syncSource(supabase, data);
  back(P);
}

export async function addBlock(f: FormData) {
  const me = await requireMember();
  const supabase = await createClient();
  let { data: src } = await supabase.from("calendar_sources").select("id").eq("owner_id", me.id).eq("kind", "manual").maybeSingle();
  if (!src) {
    const created = await supabase.from("calendar_sources").insert({ owner_id: me.id, kind: "manual", label: "Manual blocks", color: personColor(me.id), circle_ids: defaultCircleIds(me) }).select("id").single();
    src = created.data;
  }
  const allDay = f.get("all_day") === "on";
  const date = str(f, "date");
  if (!src || !date) back(P, { error: "Pick a date." });
  const starts = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${str(f, "start") || "09:00"}`);
  const ends = allDay ? new Date(starts.getTime() + 86400000) : new Date(`${date}T${str(f, "end") || "10:00"}`);
  if (ends <= starts) back(P, { error: "The end has to be after the start." });
  const { error } = await supabase.from("calendar_events").insert({
    source_id: src.id, title: str(f, "title") || "Busy", starts_at: starts.toISOString(), ends_at: ends.toISOString(), all_day: allDay,
  });
  back(P, error ? { error: error.message } : { ok: "Block added." });
}

export async function updateSource(f: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_sources").update({
    detail: str(f, "detail") === "titles" ? "titles" : "busy", circle_ids: ids(f),
  }).eq("id", str(f, "id"));
  back(P, error ? { error: error.message } : { ok: "Sharing saved." });
}

export async function syncNow(f: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("calendar_sources").select("id, owner_id, kind, ics_url, google_calendar_id").eq("id", str(f, "id")).single();
  if (data) await syncSource(supabase, data);
  back(P);
}

export async function removeSource(f: FormData) {
  const me = await requireMember();
  const supabase = await createClient();
  await supabase.from("calendar_sources").delete().eq("id", str(f, "id"));
  // Last Google calendar gone: forget the token too.
  const { count } = await supabase.from("calendar_sources").select("id", { count: "exact", head: true }).eq("kind", "google");
  if (!count) await createAdminClient().from("google_tokens").delete().eq("user_id", me.id);
  back(P, { ok: "Removed." });
}

export async function deleteBlock(f: FormData) {
  await requireMember();
  const supabase = await createClient();
  await supabase.from("calendar_events").delete().eq("id", str(f, "id"));
  back(P);
}
