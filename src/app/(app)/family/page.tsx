import { Users } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { allCircles, requireMember, type Circle } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCategory, addCircle, cancelInvite, deleteCategory, inviteMember, renameCategory, setActive, updateMember } from "./actions";

export const metadata = { title: "Family" };

export default async function FamilyPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const admin = me.role === "admin";
  const supabase = await createClient();
  const circles = await allCircles();
  // Admins also see deactivated members, which RLS hides from everyone, so they read with the service key.
  const db = admin ? createAdminClient() : supabase;
  const [{ data: people }, { data: links }, { data: invites }, { data: categories }] = await Promise.all([
    db.from("profiles").select("id, email, display_name, role, active, birthday, home_label").order("display_name"),
    db.from("circle_members").select("circle_id, user_id"),
    admin ? db.from("invites").select("*").order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("categories").select("id, scope, name").order("scope").order("sort").order("name"),
  ]);
  const circlesOf = (id: string) => (links ?? []).filter((l) => l.user_id === id).map((l) => l.circle_id);
  const core = circles.find((c) => c.kind === "core");

  return (
    <div className="space-y-5">
      <PageHeader icon={Users} title="Family" subtitle={admin ? "Invite people, set who is core or extended, and manage circles." : "Everyone in your family network."} />
      <Flash searchParams={searchParams} />

      {admin && (
        <Section title="Invite someone">
          <form action={inviteMember} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
            <div><label className="label" htmlFor="display_name">Name</label><input className="input" id="display_name" name="display_name" /></div>
            <div><label className="label" htmlFor="role">Role</label>
              <select className="input" id="role" name="role"><option value="member">Member</option><option value="admin">Admin</option></select></div>
            <div className="md:col-span-3"><CirclePicker circles={circles} defaults={core ? [core.id] : []} label="Circles" /></div>
            <div className="md:col-span-3"><ConfirmSubmit className="btn-primary" pending="Sending...">Send invite</ConfirmSubmit></div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="table-head"><th className="px-2 py-2">Name</th><th className="px-2 py-2">Circles</th><th className="px-2 py-2">Role</th>{admin && <th className="px-2 py-2" />}</tr></thead>
            <tbody>
              {(people ?? []).map((p) => (
                <tr key={p.id} className={`table-row align-top ${p.active ? "" : "opacity-60"}`}>
                  <td className="px-2 py-2">
                    <b>{p.display_name}</b>{!p.active && <span className="pill ml-1 bg-ink/5 text-muted">deactivated</span>}
                    <span className="block text-xs text-muted">{p.email}{p.home_label ? ` · ${p.home_label}` : ""}</span>
                  </td>
                  {admin ? (
                    <td className="px-2 py-2" colSpan={2}>
                      <form action={updateMember} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        {circles.map((c) => (
                          <label key={c.id} className="flex items-center gap-1">
                            <input type="checkbox" name="circle_ids" value={c.id} defaultChecked={circlesOf(p.id).includes(c.id)} className="accent-brand" />
                            <CircleBadge circle={c} />
                          </label>
                        ))}
                        <select name="role" defaultValue={p.role} className="input w-auto py-1"><option value="member">Member</option><option value="admin">Admin</option></select>
                        <ConfirmSubmit className="btn-small" pending="Saving...">Save</ConfirmSubmit>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-2"><Badges ids={circlesOf(p.id)} circles={circles} /></td>
                      <td className="px-2 py-2 capitalize">{p.role}</td>
                    </>
                  )}
                  {admin && (
                    <td className="px-2 py-2 text-right">
                      {p.id !== me.id && (
                        <form action={setActive}>
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} />
                          <ConfirmSubmit className="btn-small" confirm={p.active ? `Deactivate ${p.display_name}? They keep their history but lose access.` : undefined}>
                            {p.active ? "Deactivate" : "Reactivate"}
                          </ConfirmSubmit>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {admin && (
        <div className="grid gap-5 xl:grid-cols-2">
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
              <div key={scope} className="mb-4">
                <h3 className="label">{scope === "resource" ? "Resources" : "Requests"}</h3>
                <ul className="space-y-1">
                  {(categories ?? []).filter((c) => c.scope === scope).map((c) => (
                    <li key={c.id} className="flex gap-1">
                      <form action={renameCategory} className="flex flex-1 gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input className="input py-1" name="name" defaultValue={c.name} aria-label="Category name" />
                        <ConfirmSubmit className="btn-small">Rename</ConfirmSubmit>
                      </form>
                      <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit className="btn-small" confirm={`Remove ${c.name}?`}>Remove</ConfirmSubmit></form>
                    </li>
                  ))}
                </ul>
                <form action={addCategory} className="mt-2 flex gap-1">
                  <input type="hidden" name="scope" value={scope} />
                  <input className="input py-1" name="name" placeholder="New category" required />
                  <ConfirmSubmit className="btn-small">Add</ConfirmSubmit>
                </form>
              </div>
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
