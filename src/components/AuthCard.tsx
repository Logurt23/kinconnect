import { Mark } from "./Wordmark";

/** Sign-in and password screens: full width on phones, a centered card from tablet up. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas sm:items-center sm:justify-center sm:px-4 sm:py-10">
      <div className="relative h-44 overflow-hidden bg-brand sm:hidden">
        <div className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute top-16 -left-10 h-32 w-32 rounded-full bg-[#c4b5fd]/30" />
        <div className="absolute right-16 bottom-6 h-10 w-10 rounded-full bg-[#fde68a]/60" />
      </div>
      <div className="relative -mt-16 flex-1 rounded-t-[28px] bg-canvas px-6 pt-7 pb-10 sm:mt-0 sm:w-full sm:max-w-[400px] sm:flex-none sm:rounded-3xl sm:bg-white sm:p-9 sm:shadow-soft">
        <Mark size={52} />
        <h1 className="mt-5 text-[28px] leading-tight font-extrabold tracking-tight">Kin<span className="text-brand">Connect</span></h1>
        <p className="mt-1 text-[15px] text-muted">{subtitle}</p>
        {children}
        <p className="mt-10 text-center text-xs text-muted/80">Private family app · invite only</p>
      </div>
    </div>
  );
}
