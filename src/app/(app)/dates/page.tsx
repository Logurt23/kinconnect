import { Cake } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { defaultCircleIds, requireMember, shareableCircles } from "@/lib/auth";
import { dateLabel, nextBirthday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteMilestone, postMilestone } from "./actions";

export const metadata = { title: "Dates" };

const KIND_LABEL: Record<string, string> = {
  engagement: "Engagement", new_baby: "New baby", move: "Move", graduation: "Graduation", new_job: "New job", loss: "Loss", other: "Other",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function DatesPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const q = await searchParams;
  const year = Number(q.year) || new Date().getFullYear();
  const supabase = await createClient();
  const [{ data: people }, { data: milestones }, circles] = await Promise.all([
    supabase.from("profiles").select("id, display_name, birthday").eq("active", true).order("display_name"),
    supabase.from("milestones").select("id, kind, title, note, happened_on, link_url, posted_by, subject:profiles!milestones_subject_id_fkey(display_name)")
      .order("happened_on", { ascending: false }),
    shareableCircles(),
  ]);
  const withBirthday = (people ?? []).filter((p) => p.birthday).map((p) => ({ ...p, ...nextBirthday(p.birthday!) }));
  const reminders = withBirthday.filter((p) => p.days === 0 || p.days <= 14).sort((a, b) => a.days - b.days);
  const inYear = (milestones ?? []).filter((m) => m.happened_on.startsWith(String(year)));

  return (
    <div className="space-y-5">
      <PageHeader icon={Cake} title="Dates" subtitle="Birthdays and milestones. Posted by hand, never scraped." />
      <Flash searchParams={searchParams} />
      {reminders.map((p) => (
        <p key={p.id} className={`rounded-xl border px-4 py-3 text-sm ${p.days === 0 ? "border-brand bg-brand/10 font-bold text-brand" : "border-line bg-white"}`}>
          {p.days === 0 ? `🎂 Today is ${p.display_name}'s birthday.` : `${p.display_name}'s birthday is in ${p.days} day${p.days === 1 ? "" : "s"} (${dateLabel(p.date)}).`}
        </p>
      ))}

      <Section title={`${year} at a glance`} action={
        <span className="flex gap-1 text-xs"><a className="btn-small" href={`?year=${year - 1}`}>{year - 1}</a><a className="btn-small" href={`?year=${year + 1}`}>{year + 1}</a></span>
      }>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {MONTHS.map((m, i) => {
            const b = withBirthday.filter((p) => Number(p.birthday!.slice(5, 7)) === i + 1).sort((x, y) => x.birthday!.slice(8).localeCompare(y.birthday!.slice(8)));
            const ms = inYear.filter((x) => Number(x.happened_on.slice(5, 7)) === i + 1);
            return (
              <div key={m} className="rounded-xl border border-line p-2">
                <h3 className="label">{m}</h3>
                <ul className="space-y-0.5 text-xs">
                  {b.map((p) => <li key={p.id}>🎂 {Number(p.birthday!.slice(8))} · {p.display_name}</li>)}
                  {ms.map((x) => <li key={x.id} className="text-extended">★ {Number(x.happened_on.slice(8))} · {(x.subject as unknown as { display_name: string }).display_name}: {x.title}</li>)}
                  {!b.length && !ms.length && <li className="text-muted/60">·</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Section title="Post a milestone">
          <form action={postMilestone} className="space-y-3">
            {me.role === "admin" && (
              <div><label className="label" htmlFor="subject_id">For</label>
                <select className="input" id="subject_id" name="subject_id" defaultValue={me.id}>{(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="kind">Kind</label>
                <select className="input" id="kind" name="kind">{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label" htmlFor="happened_on">Date</label><input className="input" id="happened_on" name="happened_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
            </div>
            <div><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" placeholder="We're engaged!" /></div>
            <div><label className="label" htmlFor="note">Note</label><textarea className="input min-h-16" id="note" name="note" /></div>
            <div><label className="label" htmlFor="link_url">Link to a public post (optional)</label><input className="input" id="link_url" name="link_url" type="url" placeholder="https://" />
              <p className="mt-1 text-xs text-muted">KinConnect stores the link only. It never opens or copies the post.</p></div>
            <CirclePicker circles={circles} defaults={defaultCircleIds(me)} />
            <ConfirmSubmit className="btn-primary" pending="Posting...">Post milestone</ConfirmSubmit>
          </form>
        </Section>
        <Section title="Milestones">
          {!milestones?.length ? <Empty>No milestones yet.</Empty> : (
            <ul className="divide-y divide-line">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 py-2 text-sm first:pt-0">
                  <div>
                    <span className="pill mr-1 bg-extended/10 text-extended">{KIND_LABEL[m.kind]}</span>
                    <b>{(m.subject as unknown as { display_name: string }).display_name}</b>: {m.title} <span className="text-muted">· {dateLabel(m.happened_on, { month: "short", day: "numeric", year: "numeric" })}</span>
                    {m.note && <p className="text-muted">{m.note}</p>}
                    {m.link_url && <a href={m.link_url} target="_blank" rel="noreferrer nofollow" className="text-xs text-brand underline">{m.link_url}</a>}
                  </div>
                  {(m.posted_by === me.id || me.role === "admin") && (
                    <form action={deleteMilestone}><input type="hidden" name="id" value={m.id} /><ConfirmSubmit className="btn-small" confirm="Remove this milestone?">Remove</ConfirmSubmit></form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <p className="text-xs text-muted">Birthdays come from each person&apos;s profile in Settings. Reminders show here and on Home 14 days out and on the day.</p>
    </div>
  );
}
