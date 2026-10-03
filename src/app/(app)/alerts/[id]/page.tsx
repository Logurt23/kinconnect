import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { UPDATE_LABEL } from "@/lib/alerts-labels";
import { dateTimeLabel } from "@/lib/format";
import { createClient } from "@/lib/db";
import { closeAlert, markSeen, postUpdate } from "../actions";
import { KindPill } from "@/components/KindPill";

export const metadata = { title: "Alert" };

const EMERGENCY_UPDATES = ["heading_over", "on_scene", "resolved"] as const;
const WEATHER_UPDATES = ["safe", "power_out", "hurt", "need_contact"] as const;

export default async function AlertPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const me = await requireMember();
  const db = await createClient();
  const { data: a } = await db.from("alerts")
    .select("*, sender:profiles!alerts_sender_id_fkey(display_name), closer:profiles!alerts_closed_by_fkey(display_name)")
    .eq("id", id).maybeSingle();
  if (!a) notFound();
  // Opening it marks it read.
  if (a.sender_id !== me.id) await db.from("alert_receipts").upsert({ alert_id: id, user_id: me.id }, { onConflict: "alert_id,user_id", ignoreDuplicates: true });
  const [{ data: updates }, { data: seen }, circles] = await Promise.all([
    db.from("alert_updates").select("id, kind, body, created_at, author:profiles(display_name)").eq("alert_id", id).order("created_at"),
    db.from("alert_receipts").select("seen_at").eq("alert_id", id).eq("user_id", me.id).maybeSingle(),
    allCircles(),
  ]);
  const open = !a.closed_at;
  const canClose = open && a.kind !== "notice" && (a.sender_id === me.id || me.role === "admin");
  const is911 = a.kind === "emergency_911";
  const quick = a.kind === "weather_checkin" ? (a.sender_id === me.id ? WEATHER_UPDATES : EMERGENCY_UPDATES) : EMERGENCY_UPDATES;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader icon={BellRing} title={a.kind === "notice" ? "Notice" : "Emergency"}>
        <Link href="/alerts" className="btn-secondary">All alerts</Link>
      </PageHeader>
      <Flash searchParams={searchParams} />
      <div className={`card p-4 ${a.kind === "notice" ? "" : is911 ? "border-2 border-danger" : "border-2 border-warn"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <KindPill kind={a.kind} /> {(a.sender as { display_name: string }).display_name} · {dateTimeLabel(a.opened_at)}
          <CircleBadges ids={a.circle_ids} circles={circles} />
        </div>
        <p className="mt-2 text-lg font-semibold">{a.message}</p>
        {a.location_label && <p className="mt-1 text-sm text-muted">Last checked in at <b className="text-ink">{a.location_label}</b>{a.lat != null && <> · <a className="text-brand underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${a.lat},${a.lon}`}>map</a></>}</p>}
        {is911 && <p className="mt-2 text-xs font-semibold text-danger">This app did not contact 911. If no one has, call 911.</p>}
        {a.kind !== "notice" && (
          <p className="mt-2 text-sm">{open ? <span className="pill bg-red-100 text-danger">open, pinned on Home</span> : <span className="pill bg-ink/5 text-muted">closed {dateTimeLabel(a.closed_at!)} by {(a.closer as { display_name: string } | null)?.display_name}</span>}</p>
        )}
        {a.kind === "notice" && a.sender_id !== me.id && (
          seen?.seen_at ? <p className="mt-3 text-sm text-brand">You marked this seen.</p> : (
            <form action={markSeen} className="mt-3"><input type="hidden" name="alert_id" value={id} /><ConfirmSubmit className="btn-secondary">Seen</ConfirmSubmit></form>
          )
        )}
      </div>

      {a.kind !== "notice" && (
        <Section title="Status updates">
          <ol className="space-y-2 text-sm">
            {(updates ?? []).map((u) => (
              <li key={u.id} className="flex gap-2">
                <span className="w-32 shrink-0 text-muted">{dateTimeLabel(u.created_at)}</span>
                <span><b>{(u.author as unknown as { display_name: string }).display_name}</b> · <span className="pill bg-canvas">{UPDATE_LABEL[u.kind]}</span> {u.body}</span>
              </li>
            ))}
            {!updates?.length && <li className="text-muted">No updates yet.</li>}
          </ol>
          {open && (
            <form action={postUpdate} className="mt-4 space-y-2 border-t border-line pt-3">
              <input type="hidden" name="alert_id" value={id} />
              <input className="input" name="body" placeholder="Add a note (optional)" aria-label="Note" />
              <div className="flex flex-wrap gap-2">
                {quick.map((k) => <ConfirmSubmit key={k} name="kind" value={k} className="btn-secondary">{UPDATE_LABEL[k]}</ConfirmSubmit>)}
                <ConfirmSubmit name="kind" value="note" className="btn-secondary">Post note</ConfirmSubmit>
              </div>
            </form>
          )}
          {canClose && (
            <form action={closeAlert} className="mt-4"><input type="hidden" name="alert_id" value={id} />
              <ConfirmSubmit className="btn-primary" confirm="Close this emergency? It will unpin for everyone.">Close emergency</ConfirmSubmit></form>
          )}
        </Section>
      )}
    </div>
  );
}
