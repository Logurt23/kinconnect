import "server-only";
import type { Db } from "@/lib/db";
import type { Member } from "@/lib/auth";
import { createClient } from "@/lib/db";

export type NwsAlert = { id: string; event: string; severity: string; headline: string | null; expires: string | null; areaDesc: string };

const BASE = process.env.NWS_BASE_URL || "https://api.weather.gov";
const TTL = 5 * 60 * 1000;
const cache = new Map<string, { at: number; alerts: NwsAlert[] }>();

/** Active NWS alerts for a point. US only; NWS asks every caller to send a User-Agent naming the app. */
export async function alertsAt(lat: number, lon: number): Promise<NwsAlert[] | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.alerts;
  try {
    const res = await fetch(`${BASE}/alerts/active?point=${key}`, {
      headers: { "User-Agent": process.env.NWS_USER_AGENT || "KinConnect family app", Accept: "application/geo+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: { properties: Record<string, string | null> }[] };
    const alerts = (body.features ?? []).map(({ properties: p }) => ({
      id: String(p.id), event: String(p.event), severity: String(p.severity), headline: p.headline, expires: p.ends ?? p.expires, areaDesc: String(p.areaDesc ?? ""),
    }));
    cache.set(key, { at: Date.now(), alerts });
    return alerts;
  } catch {
    return null;
  }
}

export const isSevere = (a: NwsAlert) => a.severity === "Severe" || a.severity === "Extreme";

/** Records a check-in prompt for each Severe or Extreme alert covering the member's point. */
export async function recordPrompts(db: Db, userId: string, lat: number, lon: number) {
  const alerts = await alertsAt(lat, lon);
  const severe = (alerts ?? []).filter(isSevere);
  if (severe.length) {
    await db.from("weather_prompts").upsert(
      severe.map((a) => ({ user_id: userId, nws_id: a.id, event: a.event, severity: a.severity, headline: a.headline, expires_at: a.expires })),
      { onConflict: "user_id,nws_id", ignoreDuplicates: true },
    );
  }
  return alerts;
}

/** Called on Home and Weather so a located member is prompted even if the cron hasn't run. */
export async function checkWeatherFor(me: Member, db?: Db) {
  if (me.lat == null || me.lon == null) return null;
  return recordPrompts(db ?? (await createClient()), me.id, me.lat, me.lon);
}
