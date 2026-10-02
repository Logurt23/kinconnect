import Link from "next/link";
import { Gift } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadges, CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, defaultCircleIds, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createList } from "./actions";

export const metadata = { title: "Lists" };

export default async function ListsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data: lists }, circles] = await Promise.all([
    supabase.from("gift_lists").select("id, kind, title, owner_id, circle_ids, owner:profiles(display_name), items:gift_items(count)").order("created_at", { ascending: false }),
    allCircles(),
  ]);
  const mine = (lists ?? []).filter((l) => l.owner_id === me.id);
  const family = (lists ?? []).filter((l) => l.owner_id !== me.id);
  const Row = ({ l }: { l: (typeof mine)[number] }) => (
    <li><Link href={`/lists/${l.id}`} className="flex flex-wrap items-center gap-2 py-2 hover:underline">
      <b>{l.title}</b><span className="pill bg-canvas capitalize">{l.kind}</span>
      <span className="text-xs text-muted">{(l.owner as unknown as { display_name: string }).display_name} · {((n) => `${n} item${n === 1 ? "" : "s"}`)((l.items as unknown as { count: number }[])[0]?.count ?? 0)}</span>
      <CircleBadges ids={l.circle_ids} circles={circles} />
    </Link></li>
  );
  return (
    <div className="space-y-5">
      <PageHeader icon={Gift} title="Lists" subtitle="Christmas, birthday and other gift lists. Claims stay hidden from the list owner." />
      <Flash searchParams={searchParams} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Family lists">{family.length ? <ul className="divide-y divide-line">{family.map((l) => <Row key={l.id} l={l} />)}</ul> : <Empty>No one has shared a list with your circles yet.</Empty>}</Section>
        <Section title="My lists">
          {mine.length ? <ul className="mb-4 divide-y divide-line">{mine.map((l) => <Row key={l.id} l={l} />)}</ul> : <Empty>You don&apos;t have a list yet.</Empty>}
          <form action={createList} className="mt-3 space-y-2 border-t border-line pt-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className="input" name="title" placeholder="List name" aria-label="List name" />
              <select className="input w-auto" name="kind" aria-label="Kind"><option value="christmas">Christmas</option><option value="birthday">Birthday</option><option value="other">Other</option></select>
            </div>
            <CirclePicker circles={circles} defaults={defaultCircleIds(me)} />
            <ConfirmSubmit className="btn-primary">New list</ConfirmSubmit>
          </form>
        </Section>
      </div>
    </div>
  );
}
