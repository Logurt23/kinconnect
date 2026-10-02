"use server";

import { requireMember } from "@/lib/auth";
import { back, str } from "@/lib/actions";
import { UPDATE_LABEL } from "@/lib/alerts-labels";
import { createClient } from "@/lib/supabase/server";

const ANSWERS = ["safe", "power_out", "hurt", "need_contact"] as const;

/** A check-in posts to the member's circles with the same pin treatment as a family alert. */
export async function checkIn(f: FormData) {
  const me = await requireMember();
  const answer = ANSWERS.find((a) => a === str(f, "answer"));
  const nwsId = str(f, "nws_id");
  if (!answer) back("/weather");
  if (!me.circles.length) back("/weather", { error: "You aren't in a circle yet. Ask an admin." });
  const supabase = await createClient();
  const { data: prompt } = await supabase.from("weather_prompts").select("event").eq("user_id", me.id).eq("nws_id", nwsId).maybeSingle();
  const event = prompt?.event ?? "Severe weather";
  const { data: alert, error } = await supabase.from("alerts").insert({
    sender_id: me.id, kind: "weather_checkin", message: `${event}: ${UPDATE_LABEL[answer]}`,
    circle_ids: me.circles.map((c) => c.id), location_label: me.home_label, lat: me.lat, lon: me.lon, nws_event_id: nwsId || null,
  }).select("id").single();
  if (error) back("/weather", { error: error.message });
  await supabase.from("alert_updates").insert({ alert_id: alert.id, author_id: me.id, kind: answer, body: null });
  // "Safe" is posted and closed at once, so it doesn't pin.
  if (answer === "safe") await supabase.from("alerts").update({ closed_at: new Date().toISOString(), closed_by: me.id }).eq("id", alert.id);
  if (nwsId) await supabase.from("weather_prompts").update({ answered_alert_id: alert.id }).eq("user_id", me.id).eq("nws_id", nwsId);
  back(`/alerts/${alert.id}`, { ok: answer === "safe" ? "Posted. Your family knows you're safe." : "Posted to your circle. Update it to Safe when you are." });
}
