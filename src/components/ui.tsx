import type { LucideIcon } from "lucide-react";
import type { Circle } from "@/lib/auth";

export function PageHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white shadow-sm">
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="text-xl leading-tight font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
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
      ? "bg-core/10 text-core ring-1 ring-core/25"
      : circle.kind === "extended"
        ? "border border-dashed border-extended/60 bg-extended/10 text-extended"
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
          <label key={c.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
            <input type="checkbox" name={name} value={c.id} defaultChecked={defaults.includes(c.id)} className="accent-brand" />
            <CircleBadge circle={c} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const cls = tone === "error" ? "bg-red-50 text-danger" : tone === "ok" ? "bg-green-50 text-brand" : "bg-canvas text-muted";
  return <p role={tone === "error" ? "alert" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${cls}`}>{children}</p>;
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    available: "bg-green-50 text-brand", open: "bg-green-50 text-brand", pending: "bg-amber-50 text-warn",
    reserved: "bg-amber-50 text-warn", claimed: "bg-amber-50 text-warn", confirmed: "bg-green-50 text-brand",
    out: "bg-sky-50 text-sky-800", paid: "bg-green-50 text-brand", done: "bg-ink/5 text-muted",
    closed: "bg-ink/5 text-muted", canceled: "bg-ink/5 text-muted", declined: "bg-ink/5 text-muted", returned: "bg-ink/5 text-muted",
  };
  return <span className={`pill ${tone[status] ?? "bg-ink/5 text-muted"}`}>{status}</span>;
}
