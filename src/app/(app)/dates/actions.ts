"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/db";

const KINDS = ["engagement", "new_baby", "move", "graduation", "new_job", "loss", "other"] as const;

export async function postMilestone(f: FormData) {
  const me = await requireMember();
  const kind = KINDS.find((k) => k === str(f, "kind")) ?? "other";
  const subject = me.role === "admin" ? str(f, "subject_id") || me.id : me.id;
  const link = optStr(f, "link_url");
  if (link && !/^https?:\/\//i.test(link)) back("/dates", { error: "Links must start with http:// or https://" });
  const circles = ids(f);
  if (!circles.length) back("/dates", { error: "Pick who can see it." });
  const db = await createClient();
  const { error } = await db.from("milestones").insert({
    subject_id: subject, posted_by: me.id, kind, title: str(f, "title") || kind.replace("_", " "),
    note: optStr(f, "note"), happened_on: str(f, "happened_on"), link_url: link, circle_ids: circles,
  });
  back("/dates", error ? { error: error.message } : { ok: "Milestone posted." });
}

export async function deleteMilestone(f: FormData) {
  await requireMember();
  const db = await createClient();
  await db.from("milestones").delete().eq("id", str(f, "id"));
  back("/dates");
}
