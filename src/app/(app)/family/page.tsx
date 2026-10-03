import { Users } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember, type Circle } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { createAdminClient, createClient } from "@/lib/db";
import { addCategory, addCircle, cancelInvite, deleteCategory, inviteMember, renameCategory, setActive, updateMember } from "./actions";

export const metadata = { title: "Family" };

export default async function FamilyPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const admin = me.role === "admin";
  const member = await createClient();
  const circles = await allCircles();
  // Admins also see deactivated members, which RLS hides from everyone, so they read with the service key.
  const db = admin ? createAdminClient() : member;
  const [{ data: people }, { data: links }, { data: invites }, { data: categories }] = await Promise.all([
    db.from("profiles").select("id, email, display_name, role, active, birthday, home_label").order("display_name"),
    db.from("circle_members").select("circle_id, user_id"),
    admin ? db.from("invites").select("*").order("created_at") : Promise.resolve({ data: [] }),
    member.from("categories").select("id, scope, name").order("scope").order("sort").order("name"),
  ]);
  const circlesOf = (id: string) => (links ?? []).filter((l) => l.user_id === id).map((l) => l.circle_id);
  const core = circles.find((c) => c.kind === "core");

  return (
    <div className="space-y-5">
      <PageHeader icon={Users} title="Family" subtitle={admin ? "Invite people, set who is core or extended, and manage circles." : "Everyone in your family network."} />
      <Flash searchParams={searchParams} />

      {admin && (
        <Section title="Invite someone">
          <form action={inviteMember} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
            <div><label className="label" htmlFor="display_name">Name</label><input className="input" id="display_name" name="display_name" /></div>
            <div><label className="label" htmlFor="role">Role</label>
              <select className="input" id="role" name="role"><option value="member">Member</option><option value="admin">Admin</option></select></div>
            <div className="sm:col-span-3"><CirclePicker circles={circles} defaults={core ? [core.id] : []} label="Circles" /></div>
            <div className="sm:col-span-3"><ConfirmSubmit className="btn-primary" pending="Sending...">Send invite</ConfirmSubmit></div>
          </form>
          {(invites ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {(invites ?? []).map((i: { email: string; role: string; circle_ids: string[]; created_at: string }) => (
                <li key={i.email} className="flex items-center justify-between gap-2 py-2">
                  <span>{i.email} <span className="text-muted">· invited {dateLabel(i.created_at)} · {i.role}</span> <Badges ids={i.circle_ids} circles={circles} /></span>
                  <form action={cancelInvite}><input type="hidden" name="email" value={i.email} /><ConfirmSubmit className="btn-small" confirm="Cancel this invite?">Cancel</ConfirmSubmit></form>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Members">
        <ul className="divide-y divide-line">
          {(people ?? []).map((p) => (
            <li key={p.id} className={`py-3 first:pt-1 last:pb-0 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="text-[15px]">{p.display_name}</b>{!p.active && <span className="pill ml-1.5 bg-ink/5 text-muted">deactivated</span>}
                  {p.role === "admin" && <span className="pill ml-1.5 bg-[#fde68a] text-ink">admin</span>}
                  <span className="block truncate text-xs text-muted">{p.email}{p.home_label ? ` · ${p.home_label}` : ""}</span>
                </div>
                {admin && p.id !== me.id && (
                  <form action={setActive}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} />
                    <ConfirmSubmit className="btn-small" confirm={p.active ? `Deactivate ${p.display_name}? They keep their history but lose access.` : undefined}>
                      {p.active ? "Deactivate" : "Reactivate"}
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
              {admin ? (
                <form action={updateMember} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  {circles.map((c) => (
                    <label key={c.id} className="flex min-h-9 items-center gap-1.5 rounded-full bg-canvas px-2.5">
                      <input type="checkbox" name="circle_ids" value={c.id} defaultChecked={circlesOf(p.id).includes(c.id)} className="h-4 w-4 accent-brand" />
                      <CircleBadge circle={c} />
                    </label>
                  ))}
                  <select name="role" defaultValue={p.role} className="input min-h-9 w-auto py-1" aria-label="Role"><option value="member">Member</option><option value="admin">Admin</option></select>
                  <ConfirmSubmit className="btn-small" pending="Saving...">Save</ConfirmSubmit>
                </form>
              ) : (
                <div className="mt-1.5"><Badges ids={circlesOf(p.id)} circles={circles} /></div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {admin && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Section title="Circles">
            <ul className="mb-3 flex flex-wrap gap-2">{circles.map((c) => <li key={c.id}><CircleBadge circle={c} /></li>)}</ul>
            <p className="mb-3 text-xs text-muted">Core gets every alert by default. Extended relatives are included per feature. Add a branch circle if the family later splits.</p>
            <form action={addCircle} className="flex gap-2">
              <input className="input" name="name" placeholder="New branch circle" required />
              <ConfirmSubmit className="btn-secondary">Add</ConfirmSubmit>
            </form>
          </Section>
          <Section title="Categories">
            {(["resource", "request"] as const).map((scope) => (
              <details key={scope} className="mb-3 rounded-2xl bg-canvas p-3 open:pb-4">
                <summary className="cursor-pointer text-[15px] font-semibold">{scope === "resource" ? "Resource categories" : "Request types"} <span className="text-muted">({(categories ?? []).filter((c) => c.scope === scope).length})</span></summary>
                <div className="mt-3">
                <ul className="space-y-1">
                  {(categories ?? []).filter((c) => c.scope === scope).map((c) => (
                    <li key={c.id} className="flex gap-1">
                      <form action={renameCategory} className="flex flex-1 gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input className="input min-h-9 py-1" name="name" defaultValue={c.name} aria-label="Category name" />
                        <ConfirmSubmit className="btn-small">Rename</ConfirmSubmit>
                      </form>
                      <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit className="btn-small" confirm={`Remove ${c.name}?`}>Remove</ConfirmSubmit></form>
                    </li>
                  ))}
                </ul>
                <form action={addCategory} className="mt-2 flex gap-1">
                  <input type="hidden" name="scope" value={scope} />
                  <input className="input min-h-9 py-1" name="name" placeholder="New category" required />
                  <ConfirmSubmit className="btn-small">Add</ConfirmSubmit>
                </form>
                </div>
              </details>
            ))}
          </Section>
        </div>
      )}
      {!admin && !(people ?? []).length && <Empty>No one here yet.</Empty>}
    </div>
  );
}

function Badges({ ids, circles }: { ids: string[]; circles: Circle[] }) {
  return <span className="inline-flex flex-wrap gap-1">{ids.map((id) => { const c = circles.find((x) => x.id === id); return c ? <CircleBadge key={id} circle={c} /> : null; })}</span>;
}
