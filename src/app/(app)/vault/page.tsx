import { FileText, Image as ImageIcon, Lock } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { remove, share, unshare, upload } from "./actions";

export const metadata = { title: "Vault" };

type Item = { id: string; title: string; mime: string; size_bytes: number; created_at: string; owner_id: string; owner: { display_name: string } };

export default async function VaultPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data }, { data: shares }, { data: people }, circles] = await Promise.all([
    supabase.from("vault_items").select("id, title, mime, size_bytes, created_at, owner_id, owner:profiles(display_name)").order("created_at", { ascending: false }),
    supabase.from("vault_shares").select("id, item_id, user_id, circle_id, person:profiles(display_name)"),
    supabase.from("profiles").select("id, display_name").eq("active", true).neq("id", me.id).order("display_name"),
    allCircles(),
  ]);
  const items = (data ?? []) as unknown as Item[];
  const mine = items.filter((i) => i.owner_id === me.id);
  const shared = items.filter((i) => i.owner_id !== me.id);
  const Icon = ({ mime }: { mime: string }) => (mime === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />);

  return (
    <div className="space-y-5">
      <PageHeader icon={Lock} title="Vault" subtitle="Private documents and photos. Yours alone unless you share one." />
      <p className="text-xs text-muted">This is private family storage, not a certified records system.</p>
      <Flash searchParams={searchParams} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Section title="Upload">
          <form action={upload} className="space-y-3">
            <div><label className="label" htmlFor="file">Image or PDF</label><input className="input" id="file" name="file" type="file" accept="image/*,application/pdf" required /></div>
            <div><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" placeholder="Car insurance card" /></div>
            <ConfirmSubmit className="btn-primary" pending="Uploading...">Upload privately</ConfirmSubmit>
          </form>
          <p className="mt-3 text-xs text-muted">Files sit in a private bucket. Opening one makes a link that expires in 60 seconds.</p>
        </Section>
        <div className="space-y-5">
          <Section title="My files">
            {!mine.length ? <Empty>Nothing in your vault yet.</Empty> : (
              <ul className="divide-y divide-line">
                {mine.map((i) => {
                  const itemShares = (shares ?? []).filter((s) => s.item_id === i.id);
                  return (
                    <li key={i.id} className="space-y-2 py-3 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={`/vault/${i.id}/open`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:underline"><Icon mime={i.mime} />{i.title}</a>
                        <span className="text-xs text-muted">{(i.size_bytes / 1024).toFixed(0)} KB · {dateLabel(i.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {itemShares.length === 0 ? <span className="pill bg-ink/5 text-muted"><Lock size={11} /> private</span> : itemShares.map((s) => {
                          const c = circles.find((x) => x.id === s.circle_id);
                          return (
                            <form key={s.id} action={unshare} className="inline-flex items-center gap-1">
                              <input type="hidden" name="share_id" value={s.id} />
                              {c ? <CircleBadge circle={c} /> : <span className="pill bg-sky-50 text-sky-800">{(s.person as unknown as { display_name: string } | null)?.display_name}</span>}
                              <ConfirmSubmit className="text-muted hover:text-danger" ariaLabel="Remove access" title="Remove access">×</ConfirmSubmit>
                            </form>
                          );
                        })}
                        <form action={share} className="inline-flex gap-1">
                          <input type="hidden" name="item_id" value={i.id} />
                          <select name="target" className="input w-auto py-1 text-xs" aria-label="Share with">
                            <option value="">Share with...</option>
                            <optgroup label="One person">{(people ?? []).map((p) => <option key={p.id} value={`user:${p.id}`}>{p.display_name}</option>)}</optgroup>
                            <optgroup label="A circle">{circles.map((c) => <option key={c.id} value={`circle:${c.id}`}>{c.name}</option>)}</optgroup>
                          </select>
                          <ConfirmSubmit className="btn-small">Share</ConfirmSubmit>
                        </form>
                        <form action={remove} className="ml-auto"><input type="hidden" name="item_id" value={i.id} /><ConfirmSubmit className="btn-small" confirm={`Delete ${i.title}?`}>Delete</ConfirmSubmit></form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Section title="Shared with me">
            {!shared.length ? <Empty>No one has shared a file with you.</Empty> : (
              <ul className="divide-y divide-line">
                {shared.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2">
                    <a href={`/vault/${i.id}/open`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold hover:underline"><Icon mime={i.mime} />{i.title}</a>
                    <span className="text-xs text-muted">from {i.owner.display_name}</span>
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
