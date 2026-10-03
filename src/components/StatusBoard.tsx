import Link from "next/link";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Section } from "@/components/ui";
import { setStatus } from "@/app/(app)/status/actions";
import type { Member } from "@/lib/auth";
import { createClient } from "@/lib/db";
import { ago, dateLabel, initials } from "@/lib/format";
import { fileUrl } from "@/lib/storage";
import { MORE_STATUSES, QUICK_STATUSES, STATUS_LABEL, STATUS_TONE, type MemberStatus } from "@/lib/status";

type Person = { id: string; display_name: string; photo_path: string | null; status_sharing: boolean };
type Status = { user_id: string; status: MemberStatus; note: string | null; until: string | null; updated_at: string };

/** Members to show: the ones I picked in Settings, else the Core circle, else everyone I share a circle with. */
export async function boardPeople(me: Member) {
  const db = await createClient();
  const [{ data: watch }, { data: links }, { data: people }] = await Promise.all([
    db.from("status_watch").select("member_id").eq("user_id", me.id),
    db.from("circle_members").select("user_id, circles(kind)"),
    db.from("profiles").select("id, display_name, photo_path, status_sharing").eq("active", true).neq("id", me.id).order("display_name"),
  ]);
  const all = (people ?? []) as Person[];
  const picked = new Set((watch ?? []).map((w) => w.member_id));
  const core = new Set((links ?? []).filter((l) => (l.circles as unknown as { kind: string } | null)?.kind === "core").map((l) => l.user_id));
  const shown = picked.size ? all.filter((p) => picked.has(p.id)) : all.filter((p) => core.has(p.id));
  return { all, shown: shown.length ? shown : all, picked };
}

function Avatar({ p }: { p: Pick<Person, "display_name" | "photo_path"> }) {
  return p.photo_path
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={fileUrl("avatars", p.photo_path)} alt="" className="h-11 w-11 rounded-full object-cover" />
    : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{initials(p.display_name)}</span>;
}

function Tile({ p, s, you }: { p: Pick<Person, "display_name" | "photo_path" | "status_sharing">; s?: Status; you?: boolean }) {
  const tone = s ? STATUS_TONE[s.status] : null;
  return (
    <li className={`flex items-center gap-3 rounded-2xl border bg-white p-3 ${s?.status === "sos" ? "border-danger" : "border-line"}`}>
      <span className="relative shrink-0">
        <Avatar p={p} />
        <span className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full ring-2 ring-white ${tone ? tone.dot : "bg-stone-300"}`} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{you ? "You" : p.display_name}</span>
        {!p.status_sharing ? <span className="text-xs text-muted">Not sharing status</span>
          : !s ? <span className="text-xs text-muted">No status yet</span>
          : <>
              <span className={`pill ring-1 ${tone!.pill}`}>{STATUS_LABEL[s.status]}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {s.note ? `${s.note} · ` : ""}{s.until ? `until ${dateLabel(s.until)} · ` : ""}{ago(s.updated_at)}
              </span>
            </>}
      </span>
    </li>
  );
}

/** The at-a-glance board on Home, with one-tap buttons for my own status. Only shown when I've turned it on. */
export async function StatusBoard({ me }: { me: Member }) {
  const db = await createClient();
  const [{ shown }, { data: statuses }] = await Promise.all([
    boardPeople(me),
    db.from("member_statuses").select("user_id, status, note, until, updated_at"),
  ]);
  const byId = new Map(((statuses ?? []) as Status[]).map((s) => [s.user_id, s]));
  const mine = byId.get(me.id);

  return (
    <Section title="Family status" action={<Link href="/settings#status" className="text-xs font-semibold text-brand">Choose who</Link>}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Tile p={me} s={mine} you />
        {shown.map((p) => <Tile key={p.id} p={p} s={byId.get(p.id)} />)}
      </ul>

      <div className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-sm font-semibold">Set my status</p>
      <form action={setStatus}>
        <input type="hidden" name="from" value="/" />
        <div className="flex flex-wrap gap-2">
          {QUICK_STATUSES.map((s) => (
            <ConfirmSubmit key={s} name="status" value={s}
              className={`btn-small ring-1 ${STATUS_TONE[s].pill} ${mine?.status === s ? "ring-2" : ""}`}>
              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${STATUS_TONE[s].dot}`} aria-hidden />{STATUS_LABEL[s]}
            </ConfirmSubmit>
          ))}
          <ConfirmSubmit name="status" value="sos" className="btn-danger px-3 py-1.5 text-sm"
            confirm="Send an SOS? Everyone in your circles gets a family emergency right away. This does not call 911.">
            SOS
          </ConfirmSubmit>
        </div>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand">More: vacation, hospital, a note or a return date</summary>
        <form action={setStatus}>
          <input type="hidden" name="from" value="/" />
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
            <div><label className="label" htmlFor="status-more">Status</label>
              <select id="status-more" name="status" className="input" defaultValue={mine?.status ?? "vacation"}>
                {[...MORE_STATUSES, ...QUICK_STATUSES].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select></div>
            <div><label className="label" htmlFor="status-note">Note (optional)</label><input id="status-note" name="note" maxLength={140} className="input" placeholder="Back Sunday night" defaultValue={mine?.note ?? ""} /></div>
            <div><label className="label" htmlFor="status-until">Until (optional)</label><input id="status-until" name="until" type="date" className="input" defaultValue={mine?.until ?? ""} /></div>
            <ConfirmSubmit className="btn-primary" pending="Saving...">Save</ConfirmSubmit>
          </div>
        </form>
      </details>
      </div>
    </Section>
  );
}
