/** Three linked people: the KinConnect mark. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="10" fill="var(--color-brand)" />
      <path d="M10 20.5 16 11l6 9.5" stroke="#fff" strokeOpacity=".55" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20.5h12" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="10.5" r="3.4" fill="#fff" />
      <circle cx="9.5" cy="21" r="3.4" fill="#fde68a" />
      <circle cx="22.5" cy="21" r="3.4" fill="#c4b5fd" />
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight text-ink ${size === "lg" ? "text-[26px]" : "text-lg"}`}>
      <Mark size={size === "lg" ? 40 : 30} />
      <span>Kin<span className="text-brand">Connect</span></span>
    </span>
  );
}
