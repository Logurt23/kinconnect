"use server";

import { requireMember } from "@/lib/auth";
import { back, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/db";
import { STATUSES, STATUS_LABEL } from "@/lib/status";

/** Sets my status from the dashboard. SOS also sends a family emergency to my circles. */
export async function setStatus(f: FormData) {
  const me = await requireMember();
  const to = /^\/[a-z]*$/.test(str(f, "from")) ? str(f, "from") : "/";
  const status = STATUSES.find((s) => s === str(f, "status"));
  if (!status) back(to);
  if (!me.status_sharing && status !== "sos") back(to, { error: "Turn on family status in Settings first." });
  const note = optStr(f, "note")?.slice(0, 140) ?? null;
  const until = /^\d{4}-\d{2}-\d{2}$/.test(str(f, "until")) ? str(f, "until") : null;
  const db = await createClient();

  if (status === "sos") {
    if (!me.circles.length) back(to, { error: "You aren't in a circle yet. Ask an admin." });
    const { data: alert, error } = await db.from("alerts").insert({
      sender_id: me.id, kind: "emergency_family", message: `SOS from ${me.display_name}${note ? `: ${note}` : ". I need help."}`,
      circle_ids: me.circles.map((c) => c.id), location_label: me.home_label, lat: me.lat, lon: me.lon,
    }).select("id").single();
    if (error) back(to, { error: error.message });
    if (me.status_sharing) await db.from("member_statuses").upsert({ user_id: me.id, status, note, until: null, updated_at: new Date().toISOString() });
    back(`/alerts/${alert.id}`, { ok: "SOS sent to your circles. This does not call 911." });
  }

  const { error } = await db.from("member_statuses").upsert({
    user_id: me.id, status, note, until: ["away", "out_of_town", "vacation", "hospitalized"].includes(status) ? until : null,
    updated_at: new Date().toISOString(),
  });
  if (error) back(to, { error: error.message });
  // Safe again: close any SOS of mine that's still open, with a "Safe" update so the family sees why.
  if (status === "safe") {
    const { data: open } = await db.from("alerts").select("id").eq("sender_id", me.id).eq("kind", "emergency_family")
      .like("message", "SOS from %").is("closed_at", null);
    for (const a of open ?? []) {
      await db.from("alert_updates").insert({ alert_id: a.id, author_id: me.id, kind: "safe", body: null });
      await db.from("alerts").update({ closed_at: new Date().toISOString(), closed_by: me.id }).eq("id", a.id);
    }
  }
  back(to, { ok: `Status set: ${STATUS_LABEL[status]}.` });
}
