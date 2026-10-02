import { HandHelping } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, CirclePicker, Empty, PageHeader, Section, StatusPill } from "@/components/ui";
import { allCircles, defaultCircleIds, requireMember, shareableCircles } from "@/lib/auth";
import { dateTimeLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { act, openRequest } from "./actions";

export const metadata = { title: "Requests" };

type Row = {
  id: string; status: string; needed_at: string | null; where_text: string | null; note: string | null; circle_ids: string[];
  requester_id: string; claimed_by: string | null;
  category: { name: string } | null; requester: { display_name: string }; claimer: { display_name: string } | null;
};

export default async function RequestsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data: categories }, circles, pick, { data }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("scope", "request").order("sort"),
    allCircles(), shareableCircles(me),
    supabase.from("service_requests")
      .select("id, status, needed_at, where_text, note, circle_ids, requester_id, claimed_by, category:categories(name), requester:profiles!service_requests_requester_id_fkey(display_name), claimer:profiles!service_requests_claimed_by_fkey(display_name)")
      .order("created_at", { ascending: false }).limit(200),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const groups = [
    { title: "Open in your circles", rows: rows.filter((r) => r.status === "open" && r.requester_id !== me.id) },
    { title: "You claimed", rows: rows.filter((r) => r.claimed_by === me.id && r.status === "claimed") },
    { title: "Your requests", rows: rows.filter((r) => r.requester_id === me.id && ["open", "claimed"].includes(r.status)) },
    { title: "Finished", rows: rows.filter((r) => ["done", "canceled"].includes(r.status)).slice(0, 20) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={HandHelping} title="Requests" subtitle="Ask the family for a hand: a ride, a sitter, a meal." />
      <Flash searchParams={searchParams} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Ask for help">
          <form action={openRequest} className="space-y-3">
            <div><label className="label" htmlFor="category_id">What</label>
              <select className="input" id="category_id" name="category_id">{(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="needed_at">When</label><input className="input" id="needed_at" name="needed_at" type="datetime-local" /></div>
              <div><label className="label" htmlFor="where_text">Where</label><input className="input" id="where_text" name="where_text" /></div>
            </div>
            <div><label className="label" htmlFor="note">Note</label><textarea className="input min-h-16" id="note" name="note" /></div>
            <CirclePicker circles={pick} defaults={defaultCircleIds(me)} />
            <ConfirmSubmit className="btn-primary" pending="Posting...">Post request</ConfirmSubmit>
          </form>
        </Section>
        <div className="space-y-5">
          {groups.map((g) => (
            <Section key={g.title} title={g.title}>
              {!g.rows.length ? <Empty>Nothing here.</Empty> : (
                <ul className="divide-y divide-line">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><b>{r.category?.name ?? "Request"}</b> <StatusPill status={r.status} /> <CircleBadges ids={r.circle_ids} circles={circles} /></div>
                        <div className="text-muted">
                          {r.requester.display_name}{r.needed_at ? ` · ${dateTimeLabel(r.needed_at)}` : ""}{r.where_text ? ` · ${r.where_text}` : ""}
                          {r.claimer ? ` · claimed by ${r.claimer.display_name}` : ""}
                        </div>
                        {r.note && <p>{r.note}</p>}
                      </div>
                      <form action={act} className="flex gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        {r.status === "open" && r.requester_id !== me.id && <ConfirmSubmit name="do" value="claim" className="btn-primary py-1">I'll do it</ConfirmSubmit>}
                        {r.status === "claimed" && r.claimed_by === me.id && <ConfirmSubmit name="do" value="unclaim" className="btn-small">Unclaim</ConfirmSubmit>}
                        {r.status === "claimed" && (r.claimed_by === me.id || r.requester_id === me.id) && <ConfirmSubmit name="do" value="done" className="btn-small">Mark done</ConfirmSubmit>}
                        {["open", "claimed"].includes(r.status) && r.requester_id === me.id && <ConfirmSubmit name="do" value="cancel" className="btn-small" confirm="Cancel this request?">Cancel</ConfirmSubmit>}
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
}
