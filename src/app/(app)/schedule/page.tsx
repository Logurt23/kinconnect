import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { googleConfigured } from "@/lib/calendar";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addBlock, addGoogleCalendar, addIcs, deleteBlock, removeSource, syncNow, updateSource } from "./actions";

export const metadata = { title: "Schedule" };

type Ev = { id: string; source_id: string; owner_id: string; owner_name: string; color: string; title: string; starts_at: string; ends_at: string; all_day: boolean };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const time = (s: string) => new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default async function SchedulePage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const q = await searchParams;
  const view = q.view === "month" ? "month" : "week";
  const anchor = typeof q.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? new Date(`${q.date}T12:00:00`) : new Date();
  let start: Date, end: Date, prev: Date, next: Date;
  if (view === "week") {
    start = addDays(anchor, -anchor.getDay());
    end = addDays(start, 7);
    prev = addDays(start, -7); next = end;
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start = addDays(first, -first.getDay());
    end = addDays(start, 42);
    prev = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1); next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  }
  const supabase = await createClient();
  const [{ data: evs }, { data: sources }, { data: blocks }, circles] = await Promise.all([
    supabase.rpc("family_events", { from_ts: start.toISOString(), to_ts: end.toISOString() }),
    supabase.from("calendar_sources").select("*").eq("owner_id", me.id).order("created_at"),
    supabase.from("calendar_events").select("id, title, starts_at, ends_at, all_day, source:calendar_sources!inner(kind, owner_id)")
      .eq("source.kind", "manual").eq("source.owner_id", me.id).gte("ends_at", new Date().toISOString()).order("starts_at").limit(20),
    allCircles(),
  ]);
  const events = (evs ?? []) as Ev[];
  const days = Array.from({ length: view === "week" ? 7 : 42 }, (_, i) => addDays(start, i));
  const on = (d: Date) => events.filter((e) => new Date(e.starts_at) < addDays(d, 1) && new Date(e.ends_at) > d);
  const people = [...new Map(events.map((e) => [e.owner_id, { name: e.owner_name, color: e.color }])).values()];
  const today = ymd(new Date());
  const title = view === "week" ? `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const hasGoogle = (sources ?? []).some((s) => s.kind === "google");

  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarDays} title="Schedule" subtitle="The family on one calendar. Read only: nothing is written back to Google or Apple." />
      <Flash searchParams={searchParams} />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-1">
            <Link className="btn-small" href={`?view=${view}&date=${ymd(prev)}`} aria-label="Previous"><ChevronLeft size={14} /></Link>
            <Link className="btn-small" href={`?view=${view}`}>Today</Link>
            <Link className="btn-small" href={`?view=${view}&date=${ymd(next)}`} aria-label="Next"><ChevronRight size={14} /></Link>
            <h2 className="ml-2 text-sm font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden flex-wrap gap-2 text-xs sm:flex">{people.map((p) => <span key={p.name} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span>)}</span>
            <span className="flex rounded-lg border border-line text-xs font-semibold">
              <Link href={`?view=week&date=${ymd(anchor)}`} className={`px-2.5 py-1 ${view === "week" ? "bg-ink text-white" : ""} rounded-l-lg`}>Week</Link>
              <Link href={`?view=month&date=${ymd(anchor)}`} className={`px-2.5 py-1 ${view === "month" ? "bg-ink text-white" : ""} rounded-r-lg`}>Month</Link>
            </span>
          </div>
        </div>
        <div className={`grid ${view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-7"} text-xs`}>
          {view === "month" && ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="border-b border-line px-2 py-1 font-bold text-muted">{d}</div>)}
          {days.map((d) => {
            const items = on(d);
            const out = view === "month" && d.getMonth() !== anchor.getMonth();
            return (
              <div key={ymd(d)} className={`min-h-24 border-r border-b border-line p-1.5 ${out ? "bg-canvas/60 text-muted" : ""} ${view === "week" ? "md:min-h-64" : ""}`}>
                <div className={`mb-1 font-semibold ${ymd(d) === today ? "text-brand" : ""}`}>
                  {view === "week" ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : d.getDate()}
                </div>
                <ul className="space-y-0.5">
                  {items.slice(0, view === "month" ? 4 : 30).map((e) => (
                    <li key={`${e.id}${ymd(d)}`} className="truncate rounded px-1 py-0.5 text-white" style={{ background: e.color }} title={`${e.owner_name}: ${e.title}`}>
                      {!e.all_day && <span className="opacity-80">{time(e.starts_at)} </span>}{e.owner_name.split(" ")[0]} · {e.title}
                    </li>
                  ))}
                  {view === "month" && items.length > 4 && <li className="text-muted">+{items.length - 4} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="My calendars">
          {!(sources ?? []).length ? <Empty>No calendars yet. Connect Google, paste an Apple subscribe link, or add a manual block.</Empty> : (
            <ul className="divide-y divide-line">
              {(sources ?? []).map((s) => (
                <li key={s.id} className="space-y-2 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><b>{s.label}</b> <span className="pill bg-canvas">{s.kind === "google" ? "connected account" : s.kind === "ics" ? "subscribe link" : "manual"}</span></span>
                    <span className="text-xs text-muted">{s.sync_error ? <span className="text-danger">{s.sync_error}</span> : s.synced_at ? `synced ${ago(s.synced_at)}` : s.kind === "manual" ? "" : "not synced yet"}</span>
                  </div>
                  <form action={updateSource} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="hidden" name="id" value={s.id} />
                    <select name="detail" defaultValue={s.detail} className="input w-auto py-1 text-xs" aria-label="Detail">
                      <option value="busy">Busy only (titles hidden)</option><option value="titles">Show titles</option>
                    </select>
                    <span className="text-muted">visible to</span>
                    {circles.map((c) => (
                      <label key={c.id} className="flex items-center gap-1"><input type="checkbox" name="circle_ids" value={c.id} defaultChecked={s.circle_ids.includes(c.id)} className="accent-brand" /><CircleBadge circle={c} /></label>
                    ))}
                    <ConfirmSubmit className="btn-small">Save</ConfirmSubmit>
                  </form>
                  <div className="flex gap-1">
                    {s.kind !== "manual" && <form action={syncNow}><input type="hidden" name="id" value={s.id} /><ConfirmSubmit className="btn-small" pending="Syncing...">Sync now</ConfirmSubmit></form>}
                    <form action={removeSource}><input type="hidden" name="id" value={s.id} /><ConfirmSubmit className="btn-small" confirm={`Remove ${s.label}?`}>Remove</ConfirmSubmit></form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">New calendars start busy only (titles hidden) and visible to your default circle. Change either here.</p>
        </Section>

        <div className="space-y-5">
          <Section title="Google Calendar">
            {googleConfigured() ? (
              <div className="space-y-3 text-sm">
                <a href="/api/google/start" className="btn-primary">{hasGoogle ? "Reconnect Google" : "Connect Google (read only)"}</a>
                {hasGoogle && (
                  <form action={addGoogleCalendar} className="flex gap-2">
                    <input className="input" name="google_calendar_id" placeholder="Another calendar ID (from Google settings)" aria-label="Calendar ID" />
                    <ConfirmSubmit className="btn-secondary">Add</ConfirmSubmit>
                  </form>
                )}
              </div>
            ) : <Empty>Google isn&apos;t set up on this site yet. An admin adds the Google client ID and secret.</Empty>}
          </Section>
          <Section title="Apple or iCloud subscribe link">
            <form action={addIcs} className="space-y-2">
              <input className="input" name="ics_url" placeholder="webcal://p01-caldav.icloud.com/published/..." aria-label="Subscribe link" required />
              <input className="input" name="label" placeholder="Label (optional)" aria-label="Label" />
              <ConfirmSubmit className="btn-secondary" pending="Adding...">Add subscribe link</ConfirmSubmit>
            </form>
            <p className="mt-2 text-xs text-muted">In Apple Calendar: right-click a calendar, Share Calendar, tick Public Calendar, copy the link. Apple has no sign-in for this, so it&apos;s a subscribe link, not a connected account.</p>
          </Section>
          <Section title="Manual block">
            <form action={addBlock} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input className="input col-span-2 sm:col-span-4" name="title" placeholder="What (optional)" aria-label="Title" />
              <input className="input" name="date" type="date" required aria-label="Date" defaultValue={today} />
              <input className="input" name="start" type="time" defaultValue="09:00" aria-label="Start" />
              <input className="input" name="end" type="time" defaultValue="10:00" aria-label="End" />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="all_day" className="accent-brand" /> All day</label>
              <div className="col-span-2 sm:col-span-4"><ConfirmSubmit className="btn-secondary">Add block</ConfirmSubmit></div>
            </form>
            {!!blocks?.length && (
              <ul className="mt-3 space-y-1 text-sm">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between">
                    <span>{b.title} · <span className="text-muted">{new Date(b.starts_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: b.all_day ? undefined : "numeric", minute: b.all_day ? undefined : "2-digit" })}</span></span>
                    <form action={deleteBlock}><input type="hidden" name="id" value={b.id} /><ConfirmSubmit className="btn-small">Delete</ConfirmSubmit></form>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
