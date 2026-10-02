import "server-only";
import ICAL from "ical.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirect = () => `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`;

const PALETTE = ["#2f6b4f", "#3b6ea5", "#8a5a2b", "#7c3aed", "#be185d", "#0e7490", "#a16207", "#4d7c0f", "#c2410c", "#475569"];
/** Each person keeps one colour everywhere on the calendar. */
export function personColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Source = { id: string; owner_id: string; kind: string; ics_url: string | null; google_calendar_id: string | null };
type Ev = { external_id: string; title: string | null; starts_at: string; ends_at: string; all_day: boolean };

const WINDOW_BACK = 30 * 86400000;
const WINDOW_AHEAD = 120 * 86400000;

/** Apple and others: a pasted subscribe link. webcal:// is the same feed over https. */
export function normalizeIcsUrl(raw: string) {
  const url = new URL(raw.trim().replace(/^webcal:\/\//i, "https://"));
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) throw new Error("Use the https or webcal link from your calendar app.");
  if (process.env.NODE_ENV === "production" && /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname)) throw new Error("That link points inside a private network.");
  return url.toString();
}

export function parseIcs(text: string, from: Date, to: Date): Ev[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  const out: Ev[] = [];
  for (const v of comp.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(v);
    if (ev.isRecurrenceException()) continue;
    const push = (start: ICAL.Time, end: ICAL.Time, key: string) => {
      const s = start.toJSDate();
      const e = end.toJSDate();
      if (e > from && s < to) out.push({ external_id: key, title: ev.summary || null, starts_at: s.toISOString(), ends_at: e.toISOString(), all_day: start.isDate });
    };
    if (ev.isRecurring()) {
      const it = ev.iterator();
      for (let next = it.next(), n = 0; next && n < 500; next = it.next(), n++) {
        if (next.toJSDate() > to) break;
        const o = ev.getOccurrenceDetails(next);
        push(o.startDate, o.endDate, `${ev.uid}:${next.toString()}`);
      }
    } else if (ev.startDate) {
      push(ev.startDate, ev.endDate ?? ev.startDate, ev.uid || `${ev.startDate.toString()}:${ev.summary}`);
    }
  }
  return out;
}

async function googleAccessToken(userId: string) {
  const { data } = await createAdminClient().from("google_tokens").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Google isn't connected.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(data.refresh_token_enc), grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error_description || "Google refused the saved connection. Reconnect it.");
  return body.access_token as string;
}

async function googleEvents(userId: string, calendarId: string, from: Date, to: Date): Promise<Ev[]> {
  const token = await googleAccessToken(userId);
  const out: Ev[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (page) q.set("pageToken", page);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message || "Google Calendar didn't answer.");
    for (const e of body.items ?? []) {
      if (e.status === "cancelled") continue;
      const allDay = Boolean(e.start?.date);
      out.push({
        external_id: e.id, title: e.summary ?? null, all_day: allDay,
        starts_at: new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00`).toISOString(),
        ends_at: new Date(e.end?.dateTime ?? `${e.end?.date}T00:00:00`).toISOString(),
      });
    }
    page = body.nextPageToken;
  } while (page);
  return out;
}

/** Re-reads one subscribed source into calendar_events. Manual sources have nothing to sync. */
export async function syncSource(db: SupabaseClient, s: Source) {
  if (s.kind === "manual") return;
  const from = new Date(Date.now() - WINDOW_BACK);
  const to = new Date(Date.now() + WINDOW_AHEAD);
  try {
    let events: Ev[];
    if (s.kind === "ics") {
      const res = await fetch(normalizeIcsUrl(s.ics_url!), { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Kinroot calendar" } });
      if (!res.ok) throw new Error(`The subscribe link answered ${res.status}.`);
      events = parseIcs(await res.text(), from, to);
    } else {
      events = await googleEvents(s.owner_id, s.google_calendar_id || "primary", from, to);
    }
    await db.from("calendar_events").delete().eq("source_id", s.id);
    for (let i = 0; i < events.length; i += 500) {
      await db.from("calendar_events").upsert(events.slice(i, i + 500).map((e) => ({ ...e, source_id: s.id })), { onConflict: "source_id,external_id" });
    }
    await db.from("calendar_sources").update({ synced_at: new Date().toISOString(), sync_error: null }).eq("id", s.id);
  } catch (e) {
    await db.from("calendar_sources").update({ sync_error: e instanceof Error ? e.message : "Sync failed." }).eq("id", s.id);
  }
}
