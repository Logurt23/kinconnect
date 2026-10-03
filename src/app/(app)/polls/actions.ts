"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/db";

const P = "/polls";
const CLOSES_IN: Record<string, number> = { "1h": 1, "3h": 3, "24h": 24, "3d": 72, "7d": 168 };
const safeBack = (f: FormData) => (/^\/[a-z]*$/.test(str(f, "from")) ? str(f, "from") : P);

export async function createPoll(f: FormData) {
  const me = await requireMember();
  const question = str(f, "question").slice(0, 200);
  const kind = str(f, "kind") === "choice" ? "choice" : "yes_no";
  const circles = ids(f);
  const labels = kind === "yes_no" ? ["Yes", "No"]
    : [...new Set(f.getAll("option").map((o) => String(o).trim().slice(0, 80)).filter(Boolean))];
  if (!question) back(P, { error: "Ask a question." });
  if (kind === "choice" && labels.length < 2) back(P, { error: "Give at least two options." });
  if (!circles.length) back(P, { error: "Pick who gets the poll." });
  const hours = CLOSES_IN[str(f, "closes_in")];
  const db = await createClient();
  const { data: poll, error } = await db.from("polls").insert({
    author_id: me.id, question, kind, allow_other: str(f, "allow_other") === "on", circle_ids: circles,
    closes_at: hours ? new Date(Date.now() + hours * 3600e3).toISOString() : null,
  }).select("id").single();
  if (error) back(P, { error: error.message });
  const { error: optError } = await db.from("poll_options").insert(labels.map((label, sort) => ({ poll_id: poll.id, label, sort })));
  if (optError) {
    await db.from("polls").delete().eq("id", poll.id);
    back(P, { error: optError.message });
  }
  back(P, { ok: "Poll sent." });
}

/** One answer per person: an option, or a written answer when the poll allows it. Voting again changes it. */
export async function vote(f: FormData) {
  const me = await requireMember();
  const to = safeBack(f);
  const pollId = str(f, "poll_id");
  const optionId = optStr(f, "option_id");
  const other = optionId ? null : optStr(f, "other_text")?.slice(0, 140) ?? null;
  if (!optionId && !other) back(to, { error: "Pick an answer or write one." });
  const db = await createClient();
  const { error } = await db.from("poll_votes").upsert({ poll_id: pollId, user_id: me.id, option_id: optionId, other_text: other });
  back(to, error ? { error: error.message.includes("row-level security") ? "That poll is closed." : error.message } : { ok: "Vote counted." });
}

export async function unvote(f: FormData) {
  const me = await requireMember();
  const db = await createClient();
  await db.from("poll_votes").delete().eq("poll_id", str(f, "poll_id")).eq("user_id", me.id);
  back(safeBack(f), { ok: "Vote taken back." });
}

export async function closePoll(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("polls").update({ closed_at: new Date().toISOString() }).eq("id", str(f, "poll_id"));
  back(P, error ? { error: error.message } : { ok: "Poll closed." });
}

export async function deletePoll(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("polls").delete().eq("id", str(f, "poll_id"));
  back(P, error ? { error: error.message } : { ok: "Poll deleted." });
}
