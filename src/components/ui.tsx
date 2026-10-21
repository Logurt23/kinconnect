import type { LucideIcon } from "lucide-react";
import type { Circle } from "@/lib/auth";

export function PageHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-1 flex flex-wrap items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        <span className="mb-2 hidden h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand lg:flex"><Icon size={20} strokeWidth={2.2} /></span>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-1 sm:px-5">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {action}
      </div>
      <div className="px-4 pt-2 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** Core and Extended look different everywhere, so the two circles are obvious at a glance. */
export function CircleBadge({ circle }: { circle: Pick<Circle, "name" | "kind" | "color"> }) {
  const style =
    circle.kind === "core"
      ? "bg-core text-white"
      : circle.kind === "extended"
        ? "border border-dashed border-extended bg-extended/10 text-extended"
        : "bg-ink/5 text-ink ring-1 ring-ink/15";
  return <span className={`pill ${style}`}>{circle.name}</span>;
}

export function CircleBadges({ ids, circles }: { ids: string[]; circles: Circle[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => {
        const c = circles.find((x) => x.id === id);
        return c ? <CircleBadge key={id} circle={c} /> : null;
      })}
    </span>
  );
}

/** Checkboxes for who sees something. The member's default circle starts ticked. */
export function CirclePicker({ circles, defaults, name = "circle_ids", label = "Who can see it" }: { circles: Circle[]; defaults: string[]; name?: string; label?: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {circles.map((c) => (
          <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft sm:min-h-9">
            <input type="checkbox" name={name} value={c.id} defaultChecked={defaults.includes(c.id)} className="h-4 w-4 accent-brand" />
            <CircleBadge circle={c} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const cls = tone === "error" ? "bg-red-50 text-danger" : tone === "ok" ? "bg-brand-soft text-brand-dark" : "bg-white text-muted";
  return <p role={tone === "error" ? "alert" : undefined} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${cls}`}>{children}</p>;
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    available: "bg-brand-soft text-brand-dark", open: "bg-brand-soft text-brand-dark", pending: "bg-amber-50 text-warn",
    reserved: "bg-amber-50 text-warn", claimed: "bg-amber-50 text-warn", confirmed: "bg-brand-soft text-brand-dark",
    out: "bg-sky-50 text-sky-800", paid: "bg-brand-soft text-brand-dark", done: "bg-ink/5 text-muted",
    closed: "bg-ink/5 text-muted", canceled: "bg-ink/5 text-muted", declined: "bg-ink/5 text-muted", returned: "bg-ink/5 text-muted",
  };
  return <span className={`pill ${tone[status] ?? "bg-ink/5 text-muted"}`}>{status}</span>;
}
