import Link from "next/link";
import { Boxes } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CirclePicker, PageHeader, Section } from "@/components/ui";
import { defaultCircleIds, requireMember, shareableCircles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createListing } from "../actions";

export const metadata = { title: "New listing" };

export default async function NewListing({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").eq("scope", "resource").order("sort");
  const circles = await shareableCircles();
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader icon={Boxes} title="New listing"><Link href="/resources" className="btn-secondary">Back</Link></PageHeader>
      <Flash searchParams={searchParams} />
      <Section title="What are you offering?">
        <form action={createListing} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" required /></div>
          <div><label className="label" htmlFor="category_id">Category</label>
            <select className="input" id="category_id" name="category_id">{(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="quantity">Quantity</label><input className="input" id="quantity" name="quantity" type="number" min={1} defaultValue={1} /></div>
          <fieldset className="sm:col-span-2">
            <legend className="label">Offer</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="card flex flex-col gap-1 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="offer_type" value="loan" defaultChecked className="accent-brand" /> Loan it</span>
                <span className="flex items-center gap-1 text-xs text-muted">for <input name="loan_days" type="number" min={1} defaultValue={60} className="input w-20 py-1" aria-label="Loan days" /> days</span>
              </label>
              <label className="card flex flex-col gap-1 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="offer_type" value="sell" className="accent-brand" /> Sell it</span>
                <span className="flex items-center gap-1 text-xs text-muted">$ <input name="price" inputMode="decimal" placeholder="0.00" className="input w-24 py-1" aria-label="Price" /></span>
              </label>
              <label className="card flex flex-col gap-1 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="offer_type" value="give" className="accent-brand" /> Give it away</span>
                <span className="text-xs text-muted">Free to family</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-muted">Prices are for information. Money moves in the Ledger or outside the app.</p>
          </fieldset>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label><textarea className="input min-h-20" id="description" name="description" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pickup_note">Pickup or shipping</label><input className="input" id="pickup_note" name="pickup_note" placeholder="Pick up from the garage, or I can ship" /></div>
          <div><label className="label" htmlFor="digital_link">Link (digital items)</label><input className="input" id="digital_link" name="digital_link" type="url" placeholder="https://" /></div>
          <div><label className="label" htmlFor="digital_instructions">Instructions</label><input className="input" id="digital_instructions" name="digital_instructions" placeholder="Whose login it is, house rules" /></div>
          <p className="text-xs text-warn sm:col-span-2">Don&apos;t put shared passwords here. Keep them in your Vault and share that item if you choose.</p>
          <div className="sm:col-span-2"><label className="label" htmlFor="photos">Photos</label><input className="input" id="photos" name="photos" type="file" accept="image/*" multiple /></div>
          <div className="sm:col-span-2"><CirclePicker circles={circles} defaults={defaultCircleIds(me)} /></div>
          <div className="sm:col-span-2"><ConfirmSubmit className="btn-primary" pending="Listing...">List it</ConfirmSubmit></div>
        </form>
      </Section>
    </div>
  );
}
