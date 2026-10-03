import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db";
import { currentUser } from "@/lib/session";

export type Circle = { id: string; name: string; kind: "core" | "extended" | "branch"; color: string };
export type Member = {
  id: string;
  email: string;
  display_name: string;
  photo_path: string | null;
  birthday: string | null;
  home_label: string | null;
  lat: number | null;
  lon: number | null;
  role: "admin" | "member";
  active: boolean;
  circles: Circle[];
};

/**
 * The signed-in, active family member, or a redirect to /login. Layouts don't re-render on client
 * navigation, so every page calls this as well (cached per request).
 */
export const requireMember = cache(async (): Promise<Member> => {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await createClient();
  // Profile and circles in one round trip.
  const { data: profile } = await db
    .from("profiles")
    .select("*, circle_members(circles(id, name, kind, color))")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.active) redirect("/login?error=inactive");
  const { circle_members: rows, ...rest } = profile as Omit<Member, "circles"> & { circle_members: { circles: Circle | null }[] };
  const circles = (rows ?? []).map((r) => r.circles).filter((c): c is Circle => Boolean(c));
  return { ...rest, circles };
});

export async function requireAdmin(): Promise<Member> {
  const me = await requireMember();
  if (me.role !== "admin") redirect("/");
  return me;
}

/** Every circle, for pickers. */
export const allCircles = cache(async (): Promise<Circle[]> => {
  const db = await createClient();
  const { data } = await db.from("circles").select("id, name, kind, color").order("kind").order("name");
  return (data ?? []) as Circle[];
});

/** Alerts go to the sender's own circles; an admin may add any circle (e.g. Extended) per send. */
export async function alertCircles(me: Member): Promise<Circle[]> {
  return me.role === "admin" ? allCircles() : me.circles;
}

/** Listings, requests, lists and the rest can be shared with any circle. */
export async function shareableCircles(): Promise<Circle[]> {
  return allCircles();
}

/** The default audience: Core when the member is in it, else their first circle. */
export function defaultCircleIds(me: Member): string[] {
  const core = me.circles.find((c) => c.kind === "core");
  return core ? [core.id] : me.circles.slice(0, 1).map((c) => c.id);
}
