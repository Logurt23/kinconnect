"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BellRing, Boxes, CalendarDays, Cake, CloudLightning, Gift, HandHelping, Home, Lock, LogOut, Menu,
  Settings, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./Wordmark";
import { initials } from "@/lib/format";

// Order is the brief's menu order.
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/resources", label: "Resources", icon: Boxes },
  { href: "/requests", label: "Requests", icon: HandHelping },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/dates", label: "Dates", icon: Cake },
  { href: "/lists", label: "Lists", icon: Gift },
  { href: "/ledger", label: "Ledger", icon: Wallet },
  { href: "/weather", label: "Weather", icon: CloudLightning },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/family", label: "Family", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="link-spinner ml-auto" /> : null;
}

type Props = { name: string; circles: { name: string; kind: string }[]; unread: number; onNavigate?: (href: string) => void };

function NavContent({ name, circles, unread, onNavigate }: Props) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <>
      <div className="px-5 py-5">
        <Wordmark dark />
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.(item.href)}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-brand text-white shadow-sm shadow-black/40" : "text-white/70 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <item.icon size={18} className={active ? "" : "text-white/50 group-hover:text-white/80"} />
              {item.label}
              {item.href === "/alerts" && unread > 0 && (
                <span className="ml-auto rounded-full bg-danger px-1.5 text-[11px] leading-5 font-bold text-white" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
              <Pending />
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] p-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initials(name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white/90" title={name}>{name}</span>
            <span className="block truncate text-[11px] text-white/50">{circles.map((c) => c.name).join(" · ") || "No circle yet"}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export function Sidebar(props: Props) {
  return (
    <div className="hidden w-56 shrink-0 bg-rail lg:block">
      <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto text-white">
        <NavContent {...props} />
      </aside>
    </div>
  );
}

export function MobileBar(props: Props) {
  const path = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    menu.current?.close();
  }, [path]);
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-rail px-4 py-3 text-white lg:hidden">
      <Link href="/" aria-label="Home"><Wordmark dark /></Link>
      <button
        type="button"
        onClick={() => menu.current?.showModal()}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white/90 ring-1 ring-white/15 hover:bg-white/10"
      >
        <Menu size={18} /> Menu
        {props.unread > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold">{props.unread}</span>}
      </button>
      <dialog
        ref={menu}
        aria-label="Menu"
        className="h-dvh max-h-none w-72 max-w-[85vw] overflow-y-auto bg-rail text-white backdrop:bg-black/60 open:flex open:flex-col"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <button type="button" onClick={() => menu.current?.close()} aria-label="Close menu" className="absolute top-4 right-3 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          <X size={20} />
        </button>
        <NavContent {...props} onNavigate={(href) => href === path && menu.current?.close()} />
      </dialog>
    </div>
  );
}
