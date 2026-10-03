import Link from "next/link";
import { CloudLightning } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { ago, dateTimeLabel } from "@/lib/format";
import { createClient } from "@/lib/db";
import { checkWeatherFor, isSevere } from "@/lib/weather";
import { checkIn } from "./actions";

export const metadata = { title: "Weather" };

export default async function WeatherPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const alerts = await checkWeatherFor(me);
  const db = await createClient();
  const [{ data: prompts }, { data: checkins }, { data: unlocated }] = await Promise.all([
    db.from("weather_prompts").select("nws_id, event, severity, headline, expires_at").eq("user_id", me.id).is("answered_alert_id", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    db.from("alerts").select("id, message, opened_at, closed_at, sender:profiles!alerts_sender_id_fkey(display_name)")
      .eq("kind", "weather_checkin").order("opened_at", { ascending: false }).limit(20),
    db.from("profiles").select("display_name").eq("active", true).is("lat", null),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader icon={CloudLightning} title="Weather" subtitle="Severe weather at each member's home base, from the National Weather Service. US only." />
      <Flash searchParams={searchParams} />

      {(prompts ?? []).map((p) => (
        <form key={p.nws_id} action={checkIn} className="rounded-xl border-2 border-warn bg-amber-50 p-4">
          <input type="hidden" name="nws_id" value={p.nws_id} />
          <p className="font-bold text-warn">{p.event} ({p.severity}) covers your home base.</p>
          {p.headline && <p className="text-sm text-ink">{p.headline}</p>}
          <p className="mt-2 text-sm font-semibold">How are you? Your answer posts to your circles.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ConfirmSubmit name="answer" value="safe" className="btn-primary">Safe</ConfirmSubmit>
            <ConfirmSubmit name="answer" value="power_out" className="btn-warn">Power out</ConfirmSubmit>
            <ConfirmSubmit name="answer" value="hurt" className="btn-danger">Hurt</ConfirmSubmit>
            <ConfirmSubmit name="answer" value="need_contact" className="btn-warn">Need contact</ConfirmSubmit>
          </div>
        </form>
      ))}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Your home base">
          {me.lat == null ? (
            <p className="text-sm">You haven&apos;t set a location, so KinConnect can&apos;t check weather for you. <Link href="/settings" className="font-semibold text-brand underline">Set your home base</Link>.</p>
          ) : alerts === null ? (
            <Empty>The National Weather Service didn&apos;t answer just now. Try again in a few minutes.</Empty>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted">{me.home_label ?? `${me.lat}, ${me.lon}`}</p>
              {!alerts.length ? <Empty>No active alerts at your home base.</Empty> : (
                <ul className="space-y-2 text-sm">
                  {alerts.map((a) => (
                    <li key={a.id} className={isSevere(a) ? "font-semibold text-warn" : ""}>
                      {a.event} <span className="pill bg-canvas">{a.severity}</span>
                      {a.expires && <span className="text-xs text-muted"> until {dateTimeLabel(a.expires)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>
        <Section title="Family check-ins">
          {!checkins?.length ? <Empty>No weather check-ins yet.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {checkins.map((c) => (
                <li key={c.id} className="py-2"><Link href={`/alerts/${c.id}`} className="hover:underline">
                  <b>{(c.sender as unknown as { display_name: string }).display_name}</b> · {c.message} · <span className="text-muted">{ago(c.opened_at)}</span>
                  {c.closed_at ? <span className="pill ml-1 bg-ink/5 text-muted">closed</span> : <span className="pill ml-1 bg-amber-100 text-warn">open</span>}
                </Link></li>
              ))}
            </ul>
          )}
          {!!unlocated?.length && <p className="mt-3 text-xs text-muted">No location set: {unlocated.map((u) => u.display_name).join(", ")}. They won&apos;t get weather prompts until they add one.</p>}
        </Section>
      </div>
    </div>
  );
}
