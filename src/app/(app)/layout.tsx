import { LiveRefresh } from "@/components/LiveRefresh";
import { MobileNav, SideNav } from "@/components/AppNav";
import { requireMember } from "@/lib/auth";
import { unreadAlertCount } from "@/lib/alerts";
import { fileUrl } from "@/lib/storage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const unread = await unreadAlertCount();
  const nav = { name: me.display_name, photo: me.photo_path ? fileUrl("avatars", me.photo_path) : null, circles: me.circles, unread };
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-soft ring-2 ring-brand focus:translate-y-0">
        Skip to content
      </a>
      <SideNav {...nav} />
      <MobileNav {...nav} />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <LiveRefresh />
    </div>
  );
}
