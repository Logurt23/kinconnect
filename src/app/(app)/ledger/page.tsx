import { Wallet } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { Empty, PageHeader, Section, StatusPill } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { dateLabel, money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addEntry, cancelEntry, markPaid } from "./actions";

export const metadata = { title: "Ledger" };

type Entry = {
  id: string; kind: string; amount_cents: number; note: string | null; status: string; created_at: string; created_by: string;
  from_id: string; to_id: string; from_marked_paid: boolean; to_marked_paid: boolean;
  from: { display_name: string }; to: { display_name: string };
};
const KIND: Record<string, string> = { request: "Request", offer: "Offer to send", iou: "IOU" };

export default async function LedgerPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("ledger_entries").select("*, from:profiles!ledger_entries_from_id_fkey(display_name), to:profiles!ledger_entries_to_id_fkey(display_name)").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name").eq("active", true).neq("id", me.id).order("display_name"),
  ]);
  const entries = (data ?? []) as unknown as Entry[];
  // Positive: they owe me. Open entries only.
  const balances = new Map<string, { name: string; cents: number }>();
  for (const e of entries.filter((x) => x.status === "open")) {
    const theyPay = e.to_id === me.id;
    const otherId = theyPay ? e.from_id : e.to_id;
    const name = theyPay ? e.from.display_name : e.to.display_name;
    const b = balances.get(otherId) ?? { name, cents: 0 };
    b.cents += theyPay ? e.amount_cents : -e.amount_cents;
    balances.set(otherId, b);
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={Wallet} title="Ledger" subtitle="Keep track of who owes whom. KinConnect never moves money." />
      <Flash searchParams={searchParams} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Section title="New entry">
            <form action={addEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="kind">Type</label>
                  <select className="input" id="kind" name="kind"><option value="request">Request money</option><option value="offer">Offer to send</option><option value="iou">IOU (I owe)</option></select></div>
                <div><label className="label" htmlFor="other_id">With</label>
                  <select className="input" id="other_id" name="other_id" required>{(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <div><label className="label" htmlFor="amount">Amount</label><input className="input" id="amount" name="amount" inputMode="decimal" placeholder="0.00" required /></div>
                <div><label className="label" htmlFor="note">For</label><input className="input" id="note" name="note" placeholder="Concert tickets" /></div>
              </div>
              <ConfirmSubmit className="btn-primary">Add</ConfirmSubmit>
            </form>
          </Section>
          <Section title="Balances">
            {![...balances.values()].some((b) => b.cents) ? <Empty>All square.</Empty> : (
              <ul className="space-y-1 text-sm">
                {[...balances.values()].filter((b) => b.cents).map((b) => (
                  <li key={b.name} className="flex justify-between"><span>{b.name}</span>
                    <b className={b.cents > 0 ? "text-brand" : "text-warn"}>{b.cents > 0 ? `owes you ${money(b.cents)}` : `you owe ${money(-b.cents)}`}</b></li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <Section title="Entries">
          {!entries.length ? <Empty>No entries yet.</Empty> : (
            <ul className="divide-y divide-line">
              {entries.map((e) => {
                const iPay = e.from_id === me.id;
                const myBox = iPay ? e.from_marked_paid : e.to_marked_paid;
                const theirBox = iPay ? e.to_marked_paid : e.from_marked_paid;
                const other = iPay ? e.to.display_name : e.from.display_name;
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <span className="pill mr-1 bg-canvas">{KIND[e.kind]}</span>
                      <b>{money(e.amount_cents)}</b> {iPay ? `you pay ${other}` : `${other} pays you`}
                      {e.note && <span className="text-muted"> · {e.note}</span>} <StatusPill status={e.status} />
                      <span className="block text-xs text-muted">{dateLabel(e.created_at)} · {other} {theirBox ? "marked it paid" : "hasn't marked it paid"}</span>
                    </div>
                    {e.status !== "canceled" && (
                      <div className="flex gap-1">
                        <form action={markPaid}>
                          <input type="hidden" name="id" value={e.id} /><input type="hidden" name="paid" value={myBox ? "0" : "1"} />
                          <ConfirmSubmit className={myBox ? "btn-small bg-brand-soft text-brand-dark" : "btn-small"}>{myBox ? "☑ You marked paid" : "☐ Mark paid"}</ConfirmSubmit>
                        </form>
                        {e.status === "open" && e.created_by === me.id && (
                          <form action={cancelEntry}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit className="btn-small" confirm="Cancel this entry?">Cancel</ConfirmSubmit></form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">An entry turns paid when both people tick it. No bank, card or payment service is involved.</p>
        </Section>
      </div>
    </div>
  );
}
