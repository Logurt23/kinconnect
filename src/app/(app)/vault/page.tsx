import { FileText, Lock, LockOpen } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/db";
import { dateLabel } from "@/lib/format";
import { vaultUnlockedFor } from "@/lib/session";
import { VAULT_QUOTA } from "@/lib/storage";
import { createPin, lockNow, remove, resetPin, setLocked, share, unlock, unshare, upload } from "./actions";

export const metadata = { title: "Vault" };

type Item = { id: string; title: string; mime: string; size_bytes: number; created_at: string; owner_id: string; locked: boolean; owner: { display_name: string } };

const TEXT_ACCEPT = ".txt,.text,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.ini,.log,.conf,.cfg,.html,.vcf,.ics,text/*";

function size(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function VaultPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const db = await createClient();
  const [{ data }, { data: shares }, { data: people }, circles, { data: used }, { data: pin }, unlocked] = await Promise.all([
    db.from("vault_items").select("id, title, mime, size_bytes, created_at, owner_id, locked, owner:profiles(display_name)").order("created_at", { ascending: false }),
    db.from("vault_shares").select("id, item_id, user_id, circle_id, person:profiles(display_name)"),
    db.from("profiles").select("id, display_name").eq("active", true).neq("id", me.id).order("display_name"),
    allCircles(),
    db.rpc("vault_usage"),
    createAdminClient().from("vault_pins").select("blocked_until").eq("user_id", me.id).maybeSingle(),
    vaultUnlockedFor(me.id),
  ]);
  const items = (data ?? []) as unknown as Item[];
  const mine = items.filter((i) => i.owner_id === me.id && !i.locked);
  const lockedItems = items.filter((i) => i.owner_id === me.id && i.locked);
  const shared = items.filter((i) => i.owner_id !== me.id);
  const usedBytes = Number(used ?? 0);
  const pct = Math.min(100, (usedBytes / VAULT_QUOTA) * 100);

  return (
    <div className="space-y-5">
      <PageHeader icon={Lock} title="Vault" subtitle="Special documents and backups, as text files. Yours alone unless you share one." />
      <p className="text-xs text-muted">This is private family storage, not a certified records system.</p>
      <Flash searchParams={searchParams} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.6fr]">
        <div className="space-y-5">
          <Section title="Upload">
            <form action={upload} className="space-y-3">
              <div><label className="label" htmlFor="file">Text file</label><input className="input" id="file" name="file" type="file" accept={TEXT_ACCEPT} required /></div>
              <div><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" placeholder="Wi-Fi and router passwords" /></div>
              {unlocked && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="locked" className="h-4 w-4 accent-brand" /> Put it in my locked section</label>
              )}
              <ConfirmSubmit className="btn-primary" pending="Uploading...">Upload privately</ConfirmSubmit>
            </form>
            <p className="mt-3 text-xs text-muted">Text files only, like .txt, .md, .csv or .json, up to 20 MB each. Images, videos, PDFs and Word files aren&apos;t accepted.</p>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold"><span>Space used</span><span className="tabular-nums">{size(usedBytes)} of 1 GB</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Vault space used">
                <div className={`h-full rounded-full ${pct > 90 ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.max(pct, usedBytes ? 1 : 0)}%` }} />
              </div>
            </div>
          </Section>

          <Section title="Locked section" action={unlocked ? <form action={lockNow}><ConfirmSubmit className="btn-small">Lock now</ConfirmSubmit></form> : null}>
            {!pin ? (
              <form action={createPin} className="space-y-3">
                <p className="text-sm text-muted">Keep your most private files behind a PIN, on top of your password. Locked files can&apos;t be shared.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label" htmlFor="new-pin">New PIN</label><input className="input" id="new-pin" name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" minLength={4} maxLength={8} autoComplete="new-password" required /></div>
                  <div><label className="label" htmlFor="confirm-pin">Confirm</label><input className="input" id="confirm-pin" name="confirm" type="password" inputMode="numeric" pattern="\d{4,8}" minLength={4} maxLength={8} autoComplete="new-password" required /></div>
                </div>
                <ConfirmSubmit className="btn-primary" pending="Saving...">Set PIN</ConfirmSubmit>
              </form>
            ) : !unlocked ? (
              <div className="space-y-3">
                <form action={unlock} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1"><label className="label" htmlFor="pin">PIN</label><input className="input" id="pin" name="pin" type="password" inputMode="numeric" maxLength={8} autoComplete="off" required /></div>
                  <ConfirmSubmit className="btn-primary" pending="Checking...">Unlock</ConfirmSubmit>
                </form>
                <p className="text-xs text-muted">Opens for 15 minutes. Five wrong tries locks it for 15 minutes.</p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-brand">Forgot PIN</summary>
                  <form action={resetPin} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div><label className="label" htmlFor="reset-password">Account password</label><input className="input" id="reset-password" name="password" type="password" autoComplete="current-password" required /></div>
                    <div><label className="label" htmlFor="reset-pin">New PIN</label><input className="input" id="reset-pin" name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" minLength={4} maxLength={8} autoComplete="new-password" required /></div>
                    <div className="sm:col-span-2"><ConfirmSubmit className="btn-secondary" pending="Saving...">Set new PIN</ConfirmSubmit></div>
                  </form>
                </details>
              </div>
            ) : !lockedItems.length ? (
              <Empty><LockOpen size={14} className="mr-1 inline" />Unlocked. Nothing in here yet: upload with &quot;Put it in my locked section&quot;, or move a file in from My files.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {lockedItems.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                    <a href={`/vault/${i.id}/open`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold hover:underline"><Lock size={16} className="shrink-0" /><span className="truncate">{i.title}</span></a>
                    <span className="flex items-center gap-2 text-xs text-muted">{size(i.size_bytes)}
                      <form action={setLocked}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="locked" value="false" /><ConfirmSubmit className="btn-small">Move out</ConfirmSubmit></form>
                      <form action={remove}><input type="hidden" name="item_id" value={i.id} /><ConfirmSubmit className="btn-small" confirm={`Delete ${i.title}?`}>Delete</ConfirmSubmit></form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="My files">
            {!mine.length ? <Empty>Nothing in your vault yet.</Empty> : (
              <ul className="divide-y divide-line">
                {mine.map((i) => {
                  const itemShares = (shares ?? []).filter((s) => s.item_id === i.id);
                  return (
                    <li key={i.id} className="space-y-2 py-3 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={`/vault/${i.id}/open`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold hover:underline"><FileText size={18} className="shrink-0" /><span className="truncate">{i.title}</span></a>
                        <span className="text-xs text-muted">{size(i.size_bytes)} · {dateLabel(i.created_at)}</span>
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
                        {unlocked && (
                          <form action={setLocked}><input type="hidden" name="item_id" value={i.id} /><input type="hidden" name="locked" value="true" />
                            <ConfirmSubmit className="btn-small" confirm={itemShares.length ? `Move ${i.title} to the locked section? Sharing stops.` : undefined}>Move to locked</ConfirmSubmit></form>
                        )}
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
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <a href={`/vault/${i.id}/open`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold hover:underline"><FileText size={18} className="shrink-0" /><span className="truncate">{i.title}</span></a>
                    <span className="shrink-0 text-xs text-muted">from {i.owner.display_name}</span>
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
