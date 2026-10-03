"use server";

import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { back, ids, optStr, str } from "@/lib/actions";
import { toCents } from "@/lib/format";
import { IMAGE_TYPES, MAX_UPLOAD, putFile, safeName, sniffType } from "@/lib/storage";
import { createClient } from "@/lib/db";

export async function createListing(f: FormData) {
  const me = await requireMember();
  const offer = (["loan", "sell", "give"] as const).find((o) => o === str(f, "offer_type")) ?? "give";
  const circles = ids(f);
  const title = str(f, "title");
  const P = "/resources/new";
  if (!title) back(P, { error: "Give it a title." });
  if (!circles.length) back(P, { error: "Pick who can see it." });
  const loanDays = Number(str(f, "loan_days")) || null;
  const price = toCents(f.get("price"));
  if (offer === "loan" && !loanDays) back(P, { error: "Set how many days the loan lasts." });
  if (offer === "sell" && price == null) back(P, { error: "Set a price." });
  const db = await createClient();
  const { data, error } = await db.from("listings").insert({
    owner_id: me.id, title, description: optStr(f, "description"), category_id: optStr(f, "category_id"),
    circle_ids: circles, offer_type: offer, loan_days: offer === "loan" ? loanDays : null,
    price_cents: offer === "sell" ? price : null, quantity: Math.max(1, Number(str(f, "quantity")) || 1),
    pickup_note: optStr(f, "pickup_note"), digital_link: optStr(f, "digital_link"), digital_instructions: optStr(f, "digital_instructions"),
  }).select("id").single();
  if (error) back(P, { error: error.message });
  const photos = f.getAll("photos").filter((p): p is File => p instanceof File && p.size > 0);
  for (const [i, photo] of photos.entries()) {
    const type = photo.size <= MAX_UPLOAD ? await sniffType(photo) : null;
    if (!type || !IMAGE_TYPES.includes(type)) continue;
    const path = `${me.id}/${data.id}/${randomUUID()}-${safeName(photo.name)}`;
    if (!(await putFile("listing-photos", path, photo, type))) await db.from("listing_photos").insert({ listing_id: data.id, path, sort: i });
  }
  back(`/resources/${data.id}`, { ok: "Listed." });
}

export async function reserve(f: FormData) {
  const me = await requireMember();
  const listing = str(f, "listing_id");
  const P = `/resources/${listing}`;
  const starts = str(f, "starts_on");
  if (!starts) back(P, { error: "Pick a start date." });
  const db = await createClient();
  const { data: l } = await db.from("listings").select("status, owner_id").eq("id", listing).single();
  if (!l || l.status !== "available") back(P, { error: "That listing isn't available right now." });
  const { error } = await db.from("reservations").insert({
    listing_id: listing, requester_id: me.id, starts_on: starts, ends_on: optStr(f, "ends_on"), note: optStr(f, "note"),
  });
  back(P, error ? { error: error.message } : { ok: "Reservation requested. The owner will confirm or decline." });
}

/** Owner: confirm, decline, mark out, mark returned. Requester: cancel. */
export async function decide(f: FormData) {
  await requireMember();
  const id = str(f, "reservation_id");
  const listing = str(f, "listing_id");
  const to = str(f, "to");
  const db = await createClient();
  const now = new Date().toISOString();
  const status = { confirm: "confirmed", decline: "declined", returned: "returned", cancel: "canceled", out: "confirmed" }[to];
  if (!status) back(`/resources/${listing}`);
  const { error } = await db.from("reservations").update({ status, decided_at: now }).eq("id", id);
  if (error) back(`/resources/${listing}`, { error: error.message });
  const listingStatus = { confirm: "reserved", out: "out", returned: "available" }[to as "confirm" | "out" | "returned"];
  if (listingStatus) await db.from("listings").update({ status: listingStatus }).eq("id", listing);
  back(`/resources/${listing}`);
}

export async function setListingStatus(f: FormData) {
  await requireMember();
  const id = str(f, "listing_id");
  const status = (["available", "reserved", "out", "closed"] as const).find((s) => s === str(f, "status"));
  const db = await createClient();
  const { error } = await db.from("listings").update({ status }).eq("id", id);
  back(`/resources/${id}`, error ? { error: error.message } : {});
}
