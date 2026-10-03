"use server";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { requireMember } from "@/lib/auth";
import { back, str } from "@/lib/actions";
import { createAdminClient, createClient } from "@/lib/db";
import { lockVault, passwordMatches, unlockVault, vaultUnlockedFor } from "@/lib/session";
import { MAX_UPLOAD, TEXT_TYPE, VAULT_QUOTA, isPlainText, putFile, removeFiles, safeName } from "@/lib/storage";

const P = "/vault";
const MAX_TRIES = 5;
const BLOCK_MINUTES = 15;

export async function upload(f: FormData) {
  const me = await requireMember();
  const file = f.get("file");
  const locked = str(f, "locked") === "on";
  if (!(file instanceof File) || file.size === 0) back(P, { error: "Choose a file." });
  if (file.size > MAX_UPLOAD) back(P, { error: "Each file must be under 20 MB." });
  if (!(await isPlainText(file))) back(P, { error: "Only text files go in the vault (for example .txt, .md, .csv or .json). Images, videos, PDFs and Word files aren't accepted." });
  if (locked && !(await vaultUnlockedFor(me.id))) back(P, { error: "Unlock the locked section first." });
  const db = await createClient();
  const { data: used } = await db.rpc("vault_usage");
  if (Number(used ?? 0) + file.size > VAULT_QUOTA) back(P, { error: "That would put you over your 1 GB of vault space. Delete something first." });
  const path = `${me.id}/${randomUUID()}-${safeName(file.name)}`;
  const upError = await putFile("vault", path, file, TEXT_TYPE);
  if (upError) back(P, { error: upError });
  const { error } = await db.from("vault_items").insert({
    owner_id: me.id, title: str(f, "title") || file.name, path, mime: TEXT_TYPE, size_bytes: file.size, locked,
  });
  if (error) {
    await removeFiles("vault", [path]);
    back(P, { error: error.message });
  }
  back(P, { ok: locked ? "Uploaded to your locked section." : "Uploaded. Only you can see it until you share it." });
}

export async function share(f: FormData) {
  await requireMember();
  const target = str(f, "target"); // "user:<id>" or "circle:<id>"
  const [kind, id] = target.split(":");
  if (!id || !["user", "circle"].includes(kind)) back(P, { error: "Pick a person or a circle." });
  const db = await createClient();
  const { error } = await db.from("vault_shares").insert({
    item_id: str(f, "item_id"), user_id: kind === "user" ? id : null, circle_id: kind === "circle" ? id : null,
  });
  back(P, error ? { error: "Locked files can't be shared. Move it out of the locked section first." } : { ok: "Shared." });
}

export async function unshare(f: FormData) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.from("vault_shares").delete().eq("id", str(f, "share_id"));
  back(P, error ? { error: error.message } : { ok: "Access removed." });
}

export async function remove(f: FormData) {
  const me = await requireMember();
  const db = await createClient();
  // Shared items are readable too, so only delete what's mine. RLS hides locked items unless unlocked.
  const { data } = await db.from("vault_items").select("path").eq("id", str(f, "item_id")).eq("owner_id", me.id).maybeSingle();
  if (data) {
    await db.from("vault_items").delete().eq("id", str(f, "item_id"));
    await removeFiles("vault", [data.path]);
  }
  back(P, { ok: "Deleted." });
}

/** Into or out of the locked section. Locking a file also stops sharing it. Both need the section unlocked. */
export async function setLocked(f: FormData) {
  const me = await requireMember();
  const id = str(f, "item_id");
  const locked = str(f, "locked") === "true";
  if (!(await vaultUnlockedFor(me.id))) back(P, { error: "Unlock the locked section first." });
  const db = await createClient();
  if (locked) await db.from("vault_shares").delete().eq("item_id", id);
  const { error } = await db.from("vault_items").update({ locked }).eq("id", id).eq("owner_id", me.id);
  back(P, error ? { error: error.message } : { ok: locked ? "Moved to the locked section and unshared." : "Moved out of the locked section." });
}

// ---------- PIN ----------

const hashPin = (pin: string) => {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
};
const pinMatches = (pin: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  const got = scryptSync(pin, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
};
const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

/** First PIN for the locked section. Changing it later goes through resetPin, which asks for the password. */
export async function createPin(f: FormData) {
  const me = await requireMember();
  const pin = str(f, "pin");
  if (!validPin(pin)) back(P, { error: "Use a PIN of 4 to 8 digits." });
  if (pin !== str(f, "confirm")) back(P, { error: "The two PINs don't match." });
  const admin = createAdminClient();
  const { data: existing } = await admin.from("vault_pins").select("user_id").eq("user_id", me.id).maybeSingle();
  if (existing) back(P, { error: "You already have a PIN. Use Forgot PIN to change it." });
  await admin.from("vault_pins").insert({ user_id: me.id, pin_hash: hashPin(pin) });
  await unlockVault(me.id);
  back(P, { ok: "PIN set. Your locked section is open for 15 minutes." });
}

export async function unlock(f: FormData) {
  const me = await requireMember();
  const admin = createAdminClient();
  const { data: row } = await admin.from("vault_pins").select("pin_hash, failed, blocked_until").eq("user_id", me.id).maybeSingle();
  if (!row) back(P, { error: "Set a PIN first." });
  if (row.blocked_until && new Date(row.blocked_until) > new Date()) back(P, { error: `Too many wrong PINs. Try again in ${BLOCK_MINUTES} minutes, or use Forgot PIN.` });
  if (!pinMatches(str(f, "pin"), row.pin_hash)) {
    const failed = row.failed + 1;
    await admin.from("vault_pins").update(failed >= MAX_TRIES
      ? { failed: 0, blocked_until: new Date(Date.now() + BLOCK_MINUTES * 60000).toISOString() }
      : { failed }).eq("user_id", me.id);
    back(P, { error: failed >= MAX_TRIES ? `Wrong PIN. Locked for ${BLOCK_MINUTES} minutes.` : `Wrong PIN. ${MAX_TRIES - failed} tries left.` });
  }
  await admin.from("vault_pins").update({ failed: 0, blocked_until: null }).eq("user_id", me.id);
  await unlockVault(me.id);
  back(P, { ok: "Unlocked for 15 minutes." });
}

export async function lockNow() {
  await requireMember();
  await lockVault();
  back(P, { ok: "Locked." });
}

/** A new PIN, after checking the account password. */
export async function resetPin(f: FormData) {
  const me = await requireMember();
  const pin = str(f, "pin");
  if (!validPin(pin)) back(P, { error: "Use a PIN of 4 to 8 digits." });
  if (!(await passwordMatches(me.email, str(f, "password")))) back(P, { error: "That password didn't match." });
  await createAdminClient().from("vault_pins").upsert({ user_id: me.id, pin_hash: hashPin(pin), failed: 0, blocked_until: null });
  await unlockVault(me.id);
  back(P, { ok: "New PIN set. Your locked section is open for 15 minutes." });
}
