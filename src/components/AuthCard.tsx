import { Wordmark } from "./Wordmark";

/** The centered sign-in card from the Four States portal, in Kinroot colours. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-rail px-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-core/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-extended/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl shadow-black/50">
        <Wordmark size="lg" />
        <p className="mt-5 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
      <p className="absolute bottom-5 text-xs text-white/40">Kinroot · private family app · invite only</p>
    </div>
  );
}
