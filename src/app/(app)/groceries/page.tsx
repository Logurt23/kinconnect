import { ShoppingBasket, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { alertCircles, allCircles, defaultCircleIds, requireMember, type Circle } from "@/lib/auth";
import { createClient } from "@/lib/db";
import { ago, dateLabel } from "@/lib/format";
import { addItem, clearChecked, deleteList, removeItem, setListDone, startList, toggleItem } from "./actions";

export const metadata = { title: "Groceries" };

type Item = { id: string; name: string; qty: string | null; note: string | null; added_by: string; checked_at: string | null; created_at: string; adder: { display_name: string }; checker: { display_name: string } | null };
type List = {
  id: string; title: string; shop_on: string | null; circle_ids: string[]; closed_at: string | null; created_at: string; owner_id: string;
  owner: { display_name: string }; items: Item[];
};

function GroceryList({ list, meId, circles }: { list: List; meId: string; circles: Circle[] }) {
  const open = !list.closed_at;
  const mineList = list.owner_id === meId;
  const items = [...list.items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const toGet = items.filter((i) => !i.checked_at);
  const got = items.filter((i) => i.checked_at);
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  const row = (i: Item) => (
    <li key={i.id} className="flex items-start gap-3 py-2">
      {open ? (
        <form action={toggleItem} className="pt-0.5">
          {hidden("list_id", list.id)}{hidden("item_id", i.id)}{hidden("got", i.checked_at ? "0" : "1")}
          <button type="submit" aria-label={i.checked_at ? `Not got: ${i.name}` : `Got it: ${i.name}`}
            className={`flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-bold ${i.checked_at ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>
            {i.checked_at ? "✓" : ""}
          </button>
        </form>
      ) : <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-md border-2 ${i.checked_at ? "border-brand bg-brand" : "border-line"}`} aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${i.checked_at ? "text-muted line-through" : ""}`}>
          {i.name}{i.qty && <span className="font-normal text-muted"> · {i.qty}</span>}
        </span>
        <span className="block text-xs text-muted">
          {i.note ? `${i.note} · ` : ""}{i.added_by === meId ? "you" : i.adder.display_name}
          {i.checked_at && i.checker ? ` · got by ${i.checker.display_name} ${ago(i.checked_at)}` : ""}
        </span>
      </span>
      {open && (i.added_by === meId || mineList) && (
        <form action={removeItem}>{hidden("list_id", list.id)}{hidden("item_id", i.id)}
          <ConfirmSubmit className="p-1 text-muted hover:text-danger" ariaLabel={`Remove ${i.name}`} title="Remove"><Trash2 size={15} /></ConfirmSubmit>
        </form>
      )}
    </li>
  );

  return (
    <article id={`list-${list.id}`} className="card scroll-mt-4 space-y-3 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold">{list.title}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{mineList ? "Your list" : `${list.owner.display_name}'s list`}{list.shop_on ? ` · shopping ${dateLabel(list.shop_on, { weekday: "short", month: "short", day: "numeric" })}` : ""}</span>
            <CircleBadges ids={list.circle_ids} circles={circles} />
            {!open && <span className="pill bg-ink/5 text-muted">done</span>}
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted">{got.length} of {items.length} got</span>
      </header>

      {open && (
        <form action={addItem} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
          {hidden("list_id", list.id)}
          <input name="name" maxLength={80} required className="input" placeholder="What do you want?" aria-label={`Add to ${list.title}`} />
          <input name="qty" maxLength={30} className="input hidden sm:block" placeholder="How many" aria-label="How many" />
          <input name="note" maxLength={140} className="input hidden sm:block" placeholder="Note (brand, size...)" aria-label="Note" />
          <ConfirmSubmit className="btn-primary" pending="Adding...">Add</ConfirmSubmit>
        </form>
      )}

      {!items.length ? <Empty>Nothing on it yet. Add what you want above.</Empty> : (
        <>
          {toGet.length > 0 && <ul className="divide-y divide-line">{toGet.map(row)}</ul>}
          {got.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">In the cart</p>
              <ul className="divide-y divide-line">{got.map(row)}</ul>
            </div>
          )}
        </>
      )}

      {mineList && (
        <footer className="flex flex-wrap gap-2 border-t border-line pt-3">
          {open && got.length > 0 && (
            <form action={clearChecked}>{hidden("list_id", list.id)}<ConfirmSubmit className="btn-small">Clear what&apos;s in the cart</ConfirmSubmit></form>
          )}
          <form action={setListDone}>{hidden("list_id", list.id)}{hidden("done", open ? "1" : "0")}
            <ConfirmSubmit className="btn-small" confirm={open ? "Mark this list done? Nobody can add to it after that." : undefined}>{open ? "Done shopping" : "Reopen"}</ConfirmSubmit></form>
          <form action={deleteList} className="ml-auto">{hidden("list_id", list.id)}
            <ConfirmSubmit className="btn-small" confirm={`Delete ${list.title} and everything on it?`}>Delete list</ConfirmSubmit></form>
        </footer>
      )}
    </article>
  );
}

export default async function GroceriesPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const db = await createClient();
  const [{ data }, circles, sendable] = await Promise.all([
    db.from("grocery_lists")
      .select("id, title, shop_on, circle_ids, closed_at, created_at, owner_id, owner:profiles!grocery_lists_owner_id_fkey(display_name), items:grocery_items(id, name, qty, note, added_by, checked_at, created_at, adder:profiles!grocery_items_added_by_fkey(display_name), checker:profiles!grocery_items_checked_by_fkey(display_name))")
      .order("created_at", { ascending: false }).limit(40),
    allCircles(), alertCircles(me),
  ]);
  const lists = (data ?? []) as unknown as List[];
  const open = lists.filter((l) => !l.closed_at);
  const done = lists.filter((l) => l.closed_at).slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader icon={ShoppingBasket} title="Groceries" subtitle="Start a list for the next store run. Everyone you send it to adds what they want." />
      <Flash searchParams={searchParams} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_2fr]">
        <Section title="Start a list">
          <form action={startList} className="space-y-3">
            <div><label className="label" htmlFor="title">Name</label><input className="input" id="title" name="title" maxLength={80} placeholder="Costco Saturday" /></div>
            <div><label className="label" htmlFor="shop_on">Shopping on (optional)</label><input className="input" id="shop_on" name="shop_on" type="date" /></div>
            <CirclePicker circles={sendable} defaults={defaultCircleIds(me)} label="Who adds to it" />
            <ConfirmSubmit className="btn-primary" pending="Starting...">Start list</ConfirmSubmit>
          </form>
        </Section>
        <div className="space-y-5">
          {!open.length ? <Section title="Open lists"><Empty>No grocery list open. Start one on the left.</Empty></Section>
            : open.map((l) => <GroceryList key={l.id} list={l} meId={me.id} circles={circles} />)}
          {done.length > 0 && (
            <Section title="Done">
              <div className="space-y-3">{done.map((l) => <GroceryList key={l.id} list={l} meId={me.id} circles={circles} />)}</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
