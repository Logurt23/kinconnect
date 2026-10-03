/** Family status, at a glance. Green means home safe; orange means still out; the rest say why someone's away. */
export const STATUSES = ["safe", "exploring", "away", "out_of_town", "vacation", "hospitalized", "incarcerated", "sos"] as const;
export type MemberStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<MemberStatus, string> = {
  safe: "Safe",
  exploring: "Still exploring",
  away: "Away",
  out_of_town: "Out of town",
  vacation: "On vacation",
  hospitalized: "In the hospital",
  incarcerated: "Incarcerated",
  sos: "SOS",
};

/** Dot and pill colors. Green and orange are the two everyday states; red is only ever SOS. */
export const STATUS_TONE: Record<MemberStatus, { dot: string; pill: string }> = {
  safe: { dot: "bg-green-600", pill: "bg-green-50 text-green-800 ring-green-600/30" },
  exploring: { dot: "bg-orange-500", pill: "bg-orange-50 text-orange-800 ring-orange-500/30" },
  away: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 ring-sky-500/30" },
  out_of_town: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 ring-sky-500/30" },
  vacation: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 ring-sky-500/30" },
  hospitalized: { dot: "bg-violet-500", pill: "bg-violet-50 text-violet-800 ring-violet-500/30" },
  incarcerated: { dot: "bg-stone-500", pill: "bg-stone-100 text-stone-700 ring-stone-500/30" },
  sos: { dot: "bg-danger", pill: "bg-red-50 text-danger ring-danger/40" },
};

/** One tap from the dashboard. The rest sit under "More". */
export const QUICK_STATUSES: MemberStatus[] = ["safe", "exploring", "away", "out_of_town"];
export const MORE_STATUSES: MemberStatus[] = ["vacation", "hospitalized", "incarcerated"];
