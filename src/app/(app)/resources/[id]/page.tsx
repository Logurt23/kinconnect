import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { offerLabel } from "@/components/OfferLabel";
import { CircleBadges, Empty, PageHeader, Section, StatusPill } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { signedUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { decide, reserve, setListingStatus } from "../actions";

export const metadata = { title: "Listing" };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const me = await requireMember();
  const supabase = await createClient();
  const { data: l } = await supabase.from("listings")
    .select("*, owner:profiles(display_name), category:categories(name), photos:listing_photos(path, sort)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const mine = l.owner_id === me.id;
  const [{ data: reservations }, circles] = await Promise.all([
    supabase.from("reservations").select("id, status, starts_on, ends_on, note, requester_id, requester:profiles(display_name)").eq("listing_id", id).order("created_at", { ascending: false }),
    allCircles(),
  ]);
  const photos = [...(l.photos ?? [])].sort((a: { sort: number }, b: { sort: number }) => a.sort - b.sort).map((p: { path: string }) => p.path);
  const urls = await signedUrls("listing-photos", photos, 300);
  const today = new Date().toISOString().slice(0, 10);
  const end = l.loan_days ? new Date(Date.now() + l.loan_days * 86400000).toISOString().slice(0, 10) : "";
  const myPending = (reservations ?? []).find((r) => r.requester_id === me.id && ["pending", "confirmed"].includes(r.status));

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader icon={Boxes} title={l.title} subtitle={`${offerLabel(l)} · ${(l.category as { name: string } | null)?.name ?? "Other"} · ${(l.owner as { display_name: string }).display_name}`}>
        <Link href="/resources" className="btn-secondary">All resources</Link>
      </PageHeader>
      <Flash searchParams={searchParams} />
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div className="card space-y-3 p-4">
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photos.map((p) => urls.get(p) && <img key={p} src={urls.get(p)} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={l.status} /><CircleBadges ids={l.circle_ids} circles={circles} />{l.quantity > 1 && <span className="text-xs text-muted">{l.quantity} available</span>}</div>
          {l.description && <p className="text-sm whitespace-pre-wrap">{l.description}</p>}
          {l.pickup_note && <p className="text-sm"><b>Pickup / shipping:</b> {l.pickup_note}</p>}
          {l.digital_link && <p className="text-sm"><b>Link:</b> <a href={l.digital_link} className="text-brand underline" target="_blank" rel="noreferrer">{l.digital_link}</a></p>}
          {l.digital_instructions && <p className="text-sm"><b>Instructions:</b> {l.digital_instructions}</p>}
          {mine && (
            <form action={setListingStatus} className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <input type="hidden" name="listing_id" value={id} />
              <span className="label mb-0">Set status</span>
              {(["available", "reserved", "out", "closed"] as const).map((s) => <ConfirmSubmit key={s} name="status" value={s} className="btn-small">{s}</ConfirmSubmit>)}
            </form>
          )}
        </div>

        <div className="space-y-5">
          {!mine && (
            <Section title="Reserve">
              {myPending ? <p className="text-sm">Your reservation is <StatusPill status={myPending.status} />.</p>
                : l.status !== "available" ? <Empty>Not available right now.</Empty> : (
                <form action={reserve} className="space-y-2">
                  <input type="hidden" name="listing_id" value={id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label" htmlFor="starts_on">From</label><input className="input" id="starts_on" name="starts_on" type="date" defaultValue={today} required /></div>
                    <div><label className="label" htmlFor="ends_on">Until</label><input className="input" id="ends_on" name="ends_on" type="date" defaultValue={end} /></div>
                  </div>
                  <input className="input" name="note" placeholder="Note to the owner" aria-label="Note" />
                  <ConfirmSubmit className="btn-primary w-full" pending="Sending...">Request to reserve</ConfirmSubmit>
                  <p className="text-xs text-muted">No payment is taken. The owner confirms or declines.</p>
                </form>
              )}
            </Section>
          )}
          <Section title={mine ? "Reservations" : "Your requests"}>
            {!(reservations ?? []).length ? <Empty>None yet.</Empty> : (
              <ul className="space-y-3 text-sm">
                {(reservations ?? []).map((r) => (
                  <li key={r.id} className="space-y-1">
                    <div><b>{(r.requester as unknown as { display_name: string }).display_name}</b> · {dateLabel(r.starts_on)}{r.ends_on ? ` to ${dateLabel(r.ends_on)}` : ""} <StatusPill status={r.status} /></div>
                    {r.note && <p className="text-muted">{r.note}</p>}
                    <form action={decide} className="flex flex-wrap gap-1">
                      <input type="hidden" name="reservation_id" value={r.id} /><input type="hidden" name="listing_id" value={id} />
                      {mine && r.status === "pending" && <><ConfirmSubmit name="to" value="confirm" className="btn-small">Confirm</ConfirmSubmit><ConfirmSubmit name="to" value="decline" className="btn-small">Decline</ConfirmSubmit></>}
                      {mine && r.status === "confirmed" && l.status !== "out" && <ConfirmSubmit name="to" value="out" className="btn-small">Handed over</ConfirmSubmit>}
                      {mine && r.status === "confirmed" && <ConfirmSubmit name="to" value="returned" className="btn-small">Returned</ConfirmSubmit>}
                      {!mine && r.requester_id === me.id && r.status === "pending" && <ConfirmSubmit name="to" value="cancel" className="btn-small">Cancel</ConfirmSubmit>}
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
