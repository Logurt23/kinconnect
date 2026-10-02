"use server";

import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const P = "/requests";

export async function openRequest(f: FormData) {
  const me = await requireMember();
  const circles = ids(f);
  if (!circles.length) back(P, { error: "Pick who can see it." });
  const when = str(f, "needed_at");
  const supabase = await createClient();
  const { error } = await supabase.from("service_requests").insert({
    requester_id: me.id, category_id: optStr(f, "category_id"), needed_at: when ? new Date(when).toISOString() : null,
    where_text: optStr(f, "where_text"), note: optStr(f, "note"), circle_ids: circles,
  });
  back(P, error ? { error: error.message } : { ok: "Request posted." });
}

export async function act(f: FormData) {
  await requireMember();
  const id = str(f, "id");
  const supabase = await createClient();
  const what = str(f, "do");
  const { error } =
    what === "claim" ? await supabase.rpc("claim_request", { r: id })
    : what === "unclaim" ? await supabase.rpc("unclaim_request", { r: id })
    : what === "done" ? await supabase.rpc("finish_request", { r: id })
    : await supabase.from("service_requests").update({ status: "canceled" }).eq("id", id).in("status", ["open", "claimed"]);
  back(P, error ? { error: error.message } : {});
}
