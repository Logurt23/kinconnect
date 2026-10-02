import Link from "next/link";
import { after } from "next/server";
import { AlertTriangle, CloudLightning, Home as HomeIcon, Siren } from "lucide-react";
import { Empty, PageHeader, Section, StatusPill } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { ALERT_LABEL } from "@/lib/alerts-labels";
import { ago, dateLabel, dateTimeLabel, money, nextBirthday } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkWeatherFor } from "@/lib/weather";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const me = await requireMember();
  const supabase = await createClient();
  // A located member gets their NWS prompt even without the cron. The check runs after the response,
  // so Home never waits on weather.gov; a new prompt shows on the next visit (the cron covers the rest).
  // Request APIs aren't available inside after(), so it writes this member's prompts with the service key.
  after(() => checkWeatherFor(me, createAdminClient()));

  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  const [open, recent, receipts, mineReserved, toDecide, claimedByMe, owed, events, people, listings, prompts] = await Promise.all([
    supabase.from("alerts").select("id, kind, message, opened_at, sender:profiles!alerts_sender_id_fkey(display_name)")
      .is("closed_at", null).neq("kind", "notice").order("opened_at", { ascending: false }),
    supabase.from("alerts").select("id, kind, message, opened_at, sender_id, sender:profiles!alerts_sender_id_fkey(display_name)")
      .neq("sender_id", me.id).order("opened_at", { ascending: false }).limit(30),
    supabase.from("alert_receipts").select("alert_id").eq("user_id", me.id),
    supabase.from("reservations").select("id, status, starts_on, ends_on, listing:listings(id, title)")
      .eq("requester_id", me.id).in("status", ["pending", "confirmed"]),
    supabase.from("reservations").select("id, starts_on, requester:profiles(display_name), listing:listings!inner(id, title, owner_id)")
      .eq("status", "pending").eq("listing.owner_id", me.id),
    supabase.from("service_requests").select("id, needed_at, note, category:categories(name), requester:profiles!service_requests_requester_id_fkey(display_name)")
      .eq("claimed_by", me.id).eq("status", "claimed"),
    supabase.from("ledger_entries").select("id, amount_cents, note, from_marked_paid, to:profiles!ledger_entries_to_id_fkey(display_name)")
      .eq("from_id", me.id).eq("status", "open"),
    supabase.rpc("family_events", { from_ts: now.toISOString(), to_ts: week.toISOString() }),
    supabase.from("profiles").select("id, display_name, birthday").eq("active", true).not("birthday", "is", null),
    supabase.from("listings").select("id, title, offer_type, price_cents, loan_days, owner:profiles(display_name)")
      .eq("status", "available").neq("owner_id", me.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("weather_prompts").select("nws_id, event, headline").eq("user_id", me.id).is("answered_alert_id", null)
      .gt("expires_at", now.toISOString()),
  ]);

  const read = new Set((receipts.data ?? []).map((r) => r.alert_id));
  const unread = (recent.data ?? []).filter((a) => !read.has(a.id));
  const birthdays = (people.data ?? [])
    .map((p) => ({ ...p, ...nextBirthday(p.birthday!) }))
    .filter((p) => p.days <= 30)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-5">
      <PageHeader icon={HomeIcon} title={`Hi, ${me.display_name.split(" ")[0]}`} subtitle={dateLabel(now, { weekday: "long", month: "long", day: "numeric" })} />

      {(prompts.data ?? []).map((p) => (
        <Link key={p.nws_id} href="/weather" className="flex items-center gap-3 rounded-xl border-2 border-warn bg-amber-50 p-4 text-warn">
          <CloudLightning size={22} />
          <span className="flex-1"><b>{p.event}</b> covers your home base. Tell the family how you are.</span>
          <span className="btn-warn">Check in</span>
        </Link>
      ))}

      {(open.data ?? []).map((a) => {
        const is911 = a.kind === "emergency_911";
        const sender = (a.sender as unknown as { display_name: string } | null)?.display_name;
        return (
          <Link key={a.id} href={`/alerts/${a.id}`}
            className={`flex items-start gap-3 rounded-xl border-2 p-4 ${is911 ? "border-danger bg-red-50 text-danger" : a.kind === "weather_checkin" ? "border-warn bg-amber-50 text-warn" : "border-warn bg-amber-50 text-warn"}`}>
            {is911 ? <Siren size={22} /> : a.kind === "weather_checkin" ? <CloudLightning size={22} /> : <AlertTriangle size={22} />}
            <span className="flex-1">
              <span className="block text-xs font-bold tracking-wide uppercase">{ALERT_LABEL[a.kind]} · open · {sender} · {ago(a.opened_at)}</span>
              <span className="block font-semibold text-ink">{a.message}</span>
            </span>
          </Link>
        );
      })}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Unread alerts" action={<Link href="/alerts" className="text-xs font-semibold text-brand">All alerts</Link>}>
          {unread.length === 0 ? <Empty>You&apos;re caught up.</Empty> : (
            <ul className="divide-y divide-line">
              {unread.slice(0, 6).map((a) => (
                <li key={a.id} className="py-2 first:pt-0 last:pb-0">
                  <Link href={`/alerts/${a.id}`} className="block hover:underline">
                    <span className="text-xs text-muted">{ALERT_LABEL[a.kind]} · {(a.sender as unknown as { display_name: string } | null)?.display_name} · {ago(a.opened_at)}</span>
                    <span className="block text-sm font-medium">{a.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Reserved for you, and waiting on you">
          {!(mineReserved.data?.length || toDecide.data?.length || claimedByMe.data?.length || owed.data?.length) ? <Empty>Nothing waiting on you.</Empty> : (
            <ul className="space-y-2 text-sm">
              {(mineReserved.data ?? []).map((r) => {
                const l = r.listing as unknown as { id: string; title: string };
                return <li key={r.id}><Link href={`/resources/${l.id}`} className="hover:underline">{l.title}</Link> <StatusPill status={r.status} /> <span className="text-muted">from {dateLabel(r.starts_on)}</span></li>;
              })}
              {(toDecide.data ?? []).map((r) => {
                const l = r.listing as unknown as { id: string; title: string };
                return <li key={r.id}><b>{(r.requester as unknown as { display_name: string }).display_name}</b> wants <Link href={`/resources/${l.id}`} className="font-semibold text-brand hover:underline">{l.title}</Link>. Confirm or decline.</li>;
              })}
              {(claimedByMe.data ?? []).map((r) => (
                <li key={r.id}>You claimed <Link href="/requests" className="font-semibold text-brand hover:underline">{(r.category as unknown as { name: string } | null)?.name ?? "a request"}</Link> for {(r.requester as unknown as { display_name: string }).display_name}{r.needed_at ? `, ${dateTimeLabel(r.needed_at)}` : ""}.</li>
              ))}
              {(owed.data ?? []).map((e) => (
                <li key={e.id}><Link href="/ledger" className="hover:underline">{money(e.amount_cents)} to {(e.to as unknown as { display_name: string }).display_name}</Link>{e.note ? <span className="text-muted"> · {e.note}</span> : null}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Next 7 days" action={<Link href="/schedule" className="text-xs font-semibold text-brand">Schedule</Link>}>
          {!events.data?.length ? <Empty>Nothing on the family calendar this week. Connect a calendar in Schedule.</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {events.data.slice(0, 10).map((e: { id: string; color: string; title: string; owner_name: string; starts_at: string; all_day: boolean }) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span className="min-w-0 sm:flex sm:gap-2"><span className="block text-xs text-muted sm:w-32 sm:shrink-0 sm:text-sm">{e.all_day ? dateLabel(e.starts_at, { weekday: "short", month: "short", day: "numeric" }) : dateTimeLabel(e.starts_at)}</span>
                  <span className="block truncate"><b>{e.owner_name}</b> · {e.title}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming birthdays" action={<Link href="/dates" className="text-xs font-semibold text-brand">Dates</Link>}>
          {birthdays.length === 0 ? <Empty>No birthdays in the next 30 days.</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {birthdays.map((b) => (
                <li key={b.id} className={b.days === 0 ? "font-bold text-brand" : b.days <= 14 ? "font-semibold" : ""}>
                  {b.display_name} · {dateLabel(b.date)} · {b.days === 0 ? "today 🎂" : `in ${b.days} day${b.days === 1 ? "" : "s"}`}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Open listings in your circles" action={<Link href="/resources" className="text-xs font-semibold text-brand">Resources</Link>}>
        {!listings.data?.length ? <Empty>No open listings yet.</Empty> : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {listings.data.map((l) => (
              <li key={l.id}>
                <Link href={`/resources/${l.id}`} className="block rounded-xl border border-line p-3 hover:border-brand">
                  <span className="block truncate text-sm font-semibold">{l.title}</span>
                  <span className="text-xs text-muted">
                    {l.offer_type === "sell" ? money(l.price_cents) : l.offer_type === "loan" ? `Loan, ${l.loan_days} days` : "Free"} · {(l.owner as unknown as { display_name: string }).display_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
