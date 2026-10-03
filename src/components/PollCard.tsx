import { Check } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { CircleBadges } from "@/components/ui";
import { closePoll, deletePoll, unvote, vote } from "@/app/(app)/polls/actions";
import type { Circle } from "@/lib/auth";
import type { Db } from "@/lib/db";
import { ago, dateTimeLabel } from "@/lib/format";

export type Poll = {
  id: string; question: string; kind: "yes_no" | "choice"; allow_other: boolean; circle_ids: string[];
  closes_at: string | null; closed_at: string | null; created_at: string; author_id: string;
  author: { display_name: string };
  options: { id: string; label: string; sort: number }[];
  votes: { user_id: string; option_id: string | null; other_text: string | null; voter: { display_name: string } }[];
};

export const isOpen = (p: Pick<Poll, "closed_at" | "closes_at">) => !p.closed_at && (!p.closes_at || new Date(p.closes_at) > new Date());

/** Polls I can see (RLS), newest first, with their options and every vote. */
export async function loadPolls(db: Db, limit = 60) {
  const { data } = await db.from("polls")
    .select("id, question, kind, allow_other, circle_ids, closes_at, closed_at, created_at, author_id, author:profiles!polls_author_id_fkey(display_name), options:poll_options(id, label, sort), votes:poll_votes(user_id, option_id, other_text, voter:profiles(display_name))")
    .order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Poll[]).map((p) => ({ ...p, options: [...p.options].sort((a, b) => a.sort - b.sort) }));
}

/** Question, one button per answer with a live tally and who picked it, and the author's controls. */
export function PollCard({ poll, meId, circles, from = "/polls" }: { poll: Poll; meId: string; circles: Circle[]; from?: string }) {
  const open = isOpen(poll);
  const mine = poll.votes.find((v) => v.user_id === meId);
  const total = poll.votes.length;
  const tally = poll.options.map((o) => ({ ...o, voters: poll.votes.filter((v) => v.option_id === o.id).map((v) => v.voter.display_name) }));
  const others = poll.votes.filter((v) => v.other_text);
  const top = Math.max(0, ...tally.map((t) => t.voters.length));

  return (
    <article id={`poll-${poll.id}`} className="space-y-3 rounded-2xl border border-line bg-white p-4 scroll-mt-4">
      <header className="space-y-1">
        <h3 className="text-[17px] leading-snug font-bold">{poll.question}</h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{poll.author.display_name} · {ago(poll.created_at)}</span>
          <CircleBadges ids={poll.circle_ids} circles={circles} />
          <span>{!open ? "closed" : poll.closes_at ? `closes ${dateTimeLabel(poll.closes_at)}` : "open"}</span>
          <span>· {total} {total === 1 ? "answer" : "answers"}</span>
        </p>
      </header>

      <ul className="space-y-2">
        {tally.map((o) => {
          const picked = mine?.option_id === o.id;
          const pct = total ? Math.round((o.voters.length / total) * 100) : 0;
          const winner = !open && o.voters.length === top && top > 0;
          return (
            <li key={o.id}>
              <form action={vote}>
                <input type="hidden" name="poll_id" value={poll.id} />
                <input type="hidden" name="option_id" value={o.id} />
                <input type="hidden" name="from" value={from} />
                <button type="submit" disabled={!open} aria-pressed={picked}
                  className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition enabled:hover:border-brand disabled:cursor-default ${picked ? "border-brand ring-1 ring-brand" : "border-line"}`}>
                  <span aria-hidden className={`absolute inset-y-0 left-0 ${winner || picked ? "bg-brand-soft" : "bg-canvas"}`} style={{ width: `${pct}%` }} />
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">{picked && <Check size={15} className="shrink-0 text-brand" />}<span className="truncate">{o.label}</span></span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{o.voters.length} · {pct}%</span>
                  </span>
                  {o.voters.length > 0 && <span className="relative mt-0.5 block truncate text-xs text-muted">{o.voters.join(", ")}</span>}
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {(poll.allow_other || others.length > 0) && (
        <div className="space-y-2">
          {others.length > 0 && (
            <ul className="space-y-1 text-sm">
              {others.map((v) => <li key={v.user_id}><b>{v.voter.display_name}:</b> {v.other_text}</li>)}
            </ul>
          )}
          {open && poll.allow_other && (
            <form action={vote} className="flex gap-2">
              <input type="hidden" name="poll_id" value={poll.id} />
              <input type="hidden" name="from" value={from} />
              <input name="other_text" maxLength={140} className="input min-w-0 flex-1 py-1.5 text-sm" placeholder="Something else..." aria-label={`Your own answer to: ${poll.question}`} defaultValue={mine?.other_text ?? ""} />
              <ConfirmSubmit className="btn-small" pending="Sending...">Answer</ConfirmSubmit>
            </form>
          )}
        </div>
      )}

      {(mine && open) || poll.author_id === meId ? (
        <footer className="flex flex-wrap gap-2 border-t border-line pt-3">
          {mine && open && (
            <form action={unvote}><input type="hidden" name="poll_id" value={poll.id} /><input type="hidden" name="from" value={from} /><ConfirmSubmit className="btn-small">Take back my answer</ConfirmSubmit></form>
          )}
          {poll.author_id === meId && open && (
            <form action={closePoll}><input type="hidden" name="poll_id" value={poll.id} /><ConfirmSubmit className="btn-small" confirm="Close this poll? Nobody can answer after that.">Close poll</ConfirmSubmit></form>
          )}
          {poll.author_id === meId && (
            <form action={deletePoll} className="ml-auto"><input type="hidden" name="poll_id" value={poll.id} /><ConfirmSubmit className="btn-small" confirm="Delete this poll and its answers?">Delete</ConfirmSubmit></form>
          )}
        </footer>
      ) : null}
    </article>
  );
}
