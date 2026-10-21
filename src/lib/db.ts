import "server-only";
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import { currentUser, vaultUnlockedFor } from "@/lib/session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PostgrestClient<any>;

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** A five-minute HS256 token for PostgREST, which switches to `role` and exposes `sub` as auth.uid(). */
export function signDbToken(claims: { role: "authenticated" | "service_role"; sub?: string; vault_unlocked?: boolean }) {
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 300 })}`;
  return `${body}.${createHmac("sha256", process.env.PGRST_JWT_SECRET!).update(body).digest("base64url")}`;
}

function client(token: string | null): Db {
  return new PostgrestClient(process.env.POSTGREST_URL!, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}

/** The signed-in member's view of the database: every row passes RLS as them. */
export async function createClient(): Promise<Db> {
  const user = await currentUser();
  if (!user) return client(null);
  return client(signDbToken({ role: "authenticated", sub: user.id, ...((await vaultUnlockedFor(user.id)) && { vault_unlocked: true }) }));
}

/** Service role. Bypasses RLS: only for admin actions, token storage and the sweeps. */
export function createAdminClient(): Db {
  return client(signDbToken({ role: "service_role" }));
}
