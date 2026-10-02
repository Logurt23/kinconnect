import { LiveRefresh } from "@/components/LiveRefresh";
import { MobileBar, Sidebar } from "@/components/Sidebar";
import { requireMember } from "@/lib/auth";
import { unreadAlertCount } from "@/lib/alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const unread = await unreadAlertCount(me.id);
  const nav = { name: me.display_name, circles: me.circles, unread };
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#main" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow-lg ring-2 ring-brand focus:translate-y-0">
        Skip to content
      </a>
      <Sidebar {...nav} />
      <MobileBar {...nav} />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none lg:px-7 lg:py-6">
        {children}
      </main>
      <LiveRefresh />
    </div>
  );
}
