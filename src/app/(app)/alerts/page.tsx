import Link from "next/link";
import { AlertTriangle, BellRing, Siren } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, defaultCircleIds, requireMember, alertCircles } from "@/lib/auth";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { sendAlert } from "./actions";
import { KindPill } from "@/components/KindPill";

export const metadata = { title: "Alerts" };

export default async function AlertsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const [circles, pick] = await Promise.all([allCircles(), alertCircles(me)]);
  const defaults = defaultCircleIds(me);
  const [{ data: alerts }, { data: receipts }] = await Promise.all([
    supabase.from("alerts").select("id, kind, message, circle_ids, opened_at, closed_at, sender_id, sender:profiles!alerts_sender_id_fkey(display_name)")
      .order("opened_at", { ascending: false }).limit(100),
    supabase.from("alert_receipts").select("alert_id").eq("user_id", me.id),
  ]);
  const read = new Set((receipts ?? []).map((r) => r.alert_id));

  return (
    <div className="space-y-5">
      <PageHeader icon={BellRing} title="Alerts" subtitle="One-time notices and emergencies, sent to a circle." />
      <Flash searchParams={searchParams} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Section title="Send a notice">
          <form action={sendAlert} className="space-y-3">
            <input type="hidden" name="kind" value="notice" />
            <textarea className="input min-h-20" name="message" maxLength={1000} required placeholder="Short message. It's a notice, not a chat: people can only mark it seen." />
            <CirclePicker circles={pick} defaults={defaults} label="Send to" />
            <ConfirmSubmit className="btn-primary" pending="Sending...">Send notice</ConfirmSubmit>
          </form>
        </Section>

        <Section title="Emergency">
          <div className="space-y-4">
            <form action={sendAlert} className="rounded-xl border-2 border-danger bg-red-50 p-3">
              <input type="hidden" name="kind" value="emergency_911" />
              <p className="flex items-center gap-2 font-bold text-danger"><Siren size={18} /> Emergency, call for help</p>
              <p className="mt-1 text-xs font-semibold text-danger">Tells your circle you need outside emergency services and where you are. This app does not contact 911. Call 911 yourself if you can.</p>
              <input className="input mt-2" name="location_label" defaultValue={me.home_label ?? ""} placeholder="Where are you?" aria-label="Where are you" />
              <input className="input mt-2" name="message" placeholder="What's happening (optional)" aria-label="What's happening" />
              <CircleHidden ids={defaults} />
              <ConfirmSubmit className="btn-danger mt-2 w-full py-3" confirm="Send a 911 emergency to your circle? This app does NOT call 911." pending="Sending...">
                Send 911 emergency to family
              </ConfirmSubmit>
            </form>

            <form action={sendAlert} className="rounded-xl border-2 border-warn bg-amber-50 p-3">
              <input type="hidden" name="kind" value="emergency_family" />
              <p className="flex items-center gap-2 font-bold text-warn"><AlertTriangle size={18} /> Family emergency</p>
              <p className="mt-1 text-xs text-warn">Serious, but not a 911 call: broken down, locked out, kid not home, a medical scare being handled.</p>
              <textarea className="input mt-2 min-h-16" name="message" required placeholder="What's going on and what you need" aria-label="What's going on" />
              <input className="input mt-2" name="location_label" defaultValue={me.home_label ?? ""} placeholder="Where are you?" aria-label="Where are you" />
              <div className="mt-2"><CirclePicker circles={pick} defaults={defaults} label="Send to" /></div>
              <ConfirmSubmit className="btn-warn mt-2 w-full" confirm="Send a family emergency to these circles?" pending="Sending...">Send family emergency</ConfirmSubmit>
            </form>
          </div>
        </Section>
      </div>

      <Section title="Inbox">
        {!alerts?.length ? <Empty>No alerts yet.</Empty> : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => {
              const unread = a.sender_id !== me.id && !read.has(a.id);
              return (
                <li key={a.id}>
                  <Link href={`/alerts/${a.id}`} className="flex items-start gap-3 py-2.5 hover:bg-canvas/60">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-danger" : "bg-transparent"}`} aria-label={unread ? "unread" : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <KindPill kind={a.kind} />
                        {(a.sender as unknown as { display_name: string }).display_name} · {ago(a.opened_at)}
                        {a.kind !== "notice" && (a.closed_at ? <span className="pill bg-ink/5">closed</span> : <span className="pill bg-red-100 text-danger">open</span>)}
                        <CircleBadges ids={a.circle_ids} circles={circles} />
                      </span>
                      <span className={`block truncate text-sm ${unread ? "font-bold" : ""}`}>{a.message}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function CircleHidden({ ids }: { ids: string[] }) {
  return <>{ids.map((id) => <input key={id} type="hidden" name="circle_ids" value={id} />)}</>;
}
