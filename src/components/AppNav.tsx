"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BellRing, Boxes, CalendarDays, Cake, CloudLightning, Gift, HandHelping, Home, LayoutGrid, Lock, LogOut,
  Settings, Users, Vote, Wallet, type LucideIcon,
} from "lucide-react";
import { Mark, Wordmark } from "./Wordmark";
import { initials } from "@/lib/format";

type Item = { href: string; label: string; icon: LucideIcon };

// The brief's menu, in its order.
const NAV: Item[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/resources", label: "Resources", icon: Boxes },
  { href: "/requests", label: "Requests", icon: HandHelping },
  { href: "/polls", label: "Polls", icon: Vote },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/dates", label: "Dates", icon: Cake },
  { href: "/lists", label: "Lists", icon: Gift },
  { href: "/ledger", label: "Ledger", icon: Wallet },
  { href: "/weather", label: "Weather", icon: CloudLightning },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/family", label: "Family", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
// On phones four sit in the tab bar and the rest open from More.
const TABS = ["/", "/alerts", "/resources", "/schedule"];

type Props = { name: string; photo: string | null; circles: { name: string; kind: string }[]; unread: number };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="link-spinner ml-auto" /> : null;
}

function Avatar({ name, photo, size = 36 }: { name: string; photo: string | null; size?: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-[#fde68a] text-xs font-extrabold text-ink" style={{ width: size, height: size }}>{initials(name)}</span>
  );
}

function Badge({ n }: { n: number }) {
  return n > 0 ? <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] leading-5 font-bold text-white" aria-label={`${n} unread`}>{n}</span> : null;
}

/** Desktop: a light sidebar. */
export function SideNav({ name, photo, circles, unread }: Props) {
  const path = usePathname();
  return (
    <div className="hidden w-64 shrink-0 lg:block">
      <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6">
        <Link href="/" className="px-2"><Wordmark /></Link>
        <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(path, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${active ? "bg-brand text-white" : "text-ink/75 hover:bg-white hover:text-ink"}`}>
                <item.icon size={19} strokeWidth={active ? 2.4 : 2} />
                {item.label}
                {item.href === "/alerts" ? <span className="ml-auto"><Badge n={unread} /></span> : <Pending />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
          <Avatar name={name} photo={photo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{name}</span>
            <span className="block truncate text-xs text-muted">{circles.map((c) => c.name).join(" · ") || "No circle yet"}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </form>
        </div>
      </aside>
    </div>
  );
}

/** Phones and tablets: a top bar, a bottom tab bar, and a More sheet with everything else. */
export function MobileNav({ name, photo, unread }: Props) {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    sheet.current?.close();
  }, [path]);
  const moreActive = !TABS.some((t) => isActive(path, t));
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-canvas/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Home" className="flex items-center gap-2 text-[17px] font-extrabold"><Mark size={28} /><span>Kin<span className="text-brand">Connect</span></span></Link>
        <Link href="/settings" aria-label="Settings"><Avatar name={name} photo={photo} size={34} /></Link>
      </header>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((i) => TABS.includes(i.href)).map((item) => {
            const active = isActive(path, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-brand-soft" : ""}`}><item.icon size={21} strokeWidth={active ? 2.4 : 2} /></span>
                {item.label}
                {item.href === "/alerts" && unread > 0 && <span className="absolute top-1.5 left-1/2 ml-2"><Badge n={unread} /></span>}
              </Link>
            );
          })}
          <button type="button" onClick={() => sheet.current?.showModal()} aria-haspopup="dialog"
            className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-semibold ${moreActive ? "text-brand" : "text-muted"}`}>
            <span className={`flex h-8 w-14 items-center justify-center rounded-full ${moreActive ? "bg-brand-soft" : ""}`}><LayoutGrid size={21} /></span>
            More
          </button>
        </div>
      </nav>

      <dialog ref={sheet} aria-label="More" className="sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[28px] bg-canvas p-0 backdrop:bg-ink/40 lg:hidden"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
          <div className="grid grid-cols-4 gap-2">
            {NAV.filter((i) => !TABS.includes(i.href)).map((item) => {
              const active = isActive(path, item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => item.href === path && sheet.current?.close()}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-semibold ${active ? "bg-brand text-white" : "bg-white text-ink shadow-soft"}`}>
                  <item.icon size={22} />{item.label}
                </Link>
              );
            })}
          </div>
          <form action="/auth/signout" method="post" className="mt-4">
            <button className="btn-secondary w-full"><LogOut size={16} /> Sign out</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
