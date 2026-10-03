import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { money } from "@/lib/format";
import { createClient } from "@/lib/db";
import { addItem, deleteList, removeItem, toggleClaim } from "../actions";

export const metadata = { title: "List" };

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const me = await requireMember();
  const db = await createClient();
  const { data: list } = await db.from("gift_lists").select("*, owner:profiles(display_name)").eq("id", id).maybeSingle();
  if (!list) notFound();
  const mine = list.owner_id === me.id;
  const { data: items } = await db.from("gift_items").select("id, title, url, note, price_guess_cents").eq("list_id", id).order("created_at");
  // RLS returns no claims at all to the list owner, so this is empty for them by construction.
  const { data: claims } = mine ? { data: [] } : await db.from("gift_claims")
    .select("item_id, claimed_by, claimer:profiles(display_name)").in("item_id", (items ?? []).map((i) => i.id));
  const claimOf = (itemId: string) => (claims ?? []).find((c) => c.item_id === itemId);
  const circles = await allCircles();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader icon={Gift} title={list.title} subtitle={`${(list.owner as { display_name: string }).display_name}'s ${list.kind} list`}>
        <Link href="/lists" className="btn-secondary">All lists</Link>
      </PageHeader>
      <Flash searchParams={searchParams} />
      <div className="flex items-center gap-2 text-xs text-muted">Shared with <CircleBadges ids={list.circle_ids} circles={circles} /></div>
      {mine && <p className="text-xs text-muted">You can&apos;t see what&apos;s been claimed on your own list. That&apos;s the point.</p>}
      <Section title="Items">
        {!items?.length ? <Empty>No items yet.</Empty> : (
          <ul className="divide-y divide-line">
            {items.map((i) => {
              const c = claimOf(i.id);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <b className={c ? "text-muted line-through" : ""}>{i.title}</b>
                    {i.price_guess_cents != null && <span className="text-muted"> · about {money(i.price_guess_cents)}</span>}
                    {i.url && <a href={i.url} target="_blank" rel="noreferrer nofollow" className="block truncate text-xs text-brand underline">{i.url}</a>}
                    {i.note && <p className="text-muted">{i.note}</p>}
                  </div>
                  <form action={mine ? removeItem : toggleClaim} className="flex items-center gap-2">
                    <input type="hidden" name="list_id" value={id} /><input type="hidden" name={mine ? "id" : "item_id"} value={i.id} />
                    {mine ? <ConfirmSubmit className="btn-small" confirm="Remove this item?">Remove</ConfirmSubmit>
                      : c ? (c.claimed_by === me.id
                        ? <><span className="pill bg-brand-soft text-brand-dark">You claimed this</span><input type="hidden" name="claim" value="0" /><ConfirmSubmit className="btn-small">Unclaim</ConfirmSubmit></>
                        : <span className="pill bg-amber-50 text-warn">Claimed by {(c.claimer as unknown as { display_name: string }).display_name}</span>)
                      : <><input type="hidden" name="claim" value="1" /><ConfirmSubmit className="btn-primary py-1">Claim</ConfirmSubmit></>}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      {mine && (
        <Section title="Add an item">
          <form action={addItem} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="hidden" name="list_id" value={id} />
            <input className="input sm:col-span-2" name="url" type="url" placeholder="Paste a link (Amazon or anywhere)" aria-label="Link" />
            <input className="input" name="title" placeholder="Title (optional with a link)" aria-label="Title" />
            <input className="input" name="price" inputMode="decimal" placeholder="Price guess" aria-label="Price guess" />
            <input className="input sm:col-span-2" name="note" placeholder="Size, color, notes" aria-label="Note" />
            <div className="flex gap-2 sm:col-span-2"><ConfirmSubmit className="btn-primary">Add item</ConfirmSubmit></div>
          </form>
          <form action={deleteList} className="mt-4 border-t border-line pt-3"><input type="hidden" name="list_id" value={id} />
            <ConfirmSubmit className="btn-small" confirm="Delete this list and its items?">Delete list</ConfirmSubmit></form>
        </Section>
      )}
    </div>
  );
}
