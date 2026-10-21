import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { Flash, type Search } from "@/components/Flash";
import { offerLabel } from "@/components/OfferLabel";
import { CircleBadges, Empty, PageHeader, StatusPill } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { fileUrls } from "@/lib/storage";
import { createClient } from "@/lib/db";

export const metadata = { title: "Resources" };

export default async function ResourcesPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const q = await searchParams;
  const db = await createClient();
  const [{ data: categories }, circles] = await Promise.all([
    db.from("categories").select("id, name").eq("scope", "resource").order("sort"), allCircles(),
  ]);
  let query = db.from("listings")
    .select("id, title, offer_type, price_cents, loan_days, status, circle_ids, owner_id, quantity, owner:profiles(display_name), category:categories(name), photos:listing_photos(path, sort)")
    .order("created_at", { ascending: false });
  const cat = typeof q.category === "string" ? q.category : "";
  const offer = typeof q.offer === "string" ? q.offer : "";
  const view = typeof q.view === "string" ? q.view : "open";
  if (cat) query = query.eq("category_id", cat);
  if (offer) query = query.eq("offer_type", offer);
  if (view === "mine") query = query.eq("owner_id", me.id);
  else if (view === "open") query = query.neq("status", "closed");
  const { data: listings } = await query;
  const covers = (listings ?? []).map((l) => [...(l.photos ?? [])].sort((a, b) => a.sort - b.sort)[0]?.path).filter(Boolean) as string[];
  const urls = fileUrls("listing-photos", covers);

  return (
    <div className="space-y-5">
      <PageHeader icon={Boxes} title="Resources" subtitle="Things family members can borrow, buy or have.">
        <Link href="/resources/new" className="btn-primary"><Plus size={16} /> New listing</Link>
      </PageHeader>
      <Flash searchParams={searchParams} />
      <form className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <select name="view" defaultValue={view} className="input sm:w-auto" aria-label="Show"><option value="open">Open listings</option><option value="mine">My listings</option><option value="all">Everything</option></select>
        <select name="category" defaultValue={cat} className="input sm:w-auto" aria-label="Category"><option value="">All categories</option>{(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="offer" defaultValue={offer} className="input sm:w-auto" aria-label="Offer"><option value="">Any offer</option><option value="loan">Loan</option><option value="sell">For sale</option><option value="give">Giving away</option></select>
        <button className="btn-secondary">Filter</button>
      </form>
      {!listings?.length ? <div className="card p-6"><Empty>No listings match. List something your family could use.</Empty></div> : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          {listings.map((l) => {
            const cover = [...(l.photos ?? [])].sort((a, b) => a.sort - b.sort)[0]?.path;
            return (
              <li key={l.id}>
                <Link href={`/resources/${l.id}`} className="card block overflow-hidden hover:border-brand">
                  <div className="flex aspect-square items-center justify-center bg-brand-soft text-brand/40 sm:aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover && urls.get(cover) ? <img src={urls.get(cover)} alt="" className="h-full w-full object-cover" /> : <Boxes size={30} />}
                  </div>
                  <div className="space-y-1 p-3">
                    <b className="block truncate text-sm">{l.title}</b><StatusPill status={l.status} />
                    <p className="text-xs text-muted">{offerLabel(l)} · {(l.category as unknown as { name: string } | null)?.name ?? "Other"}{l.quantity > 1 ? ` · ${l.quantity} available` : ""}</p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted">{(l.owner as unknown as { display_name: string }).display_name} · <CircleBadges ids={l.circle_ids} circles={circles} /></p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
