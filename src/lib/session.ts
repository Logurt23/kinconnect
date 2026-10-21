import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Sign-in is Google Cloud Identity Platform. Everything happens on the server: the password goes to the
 * Identity Toolkit API, and the browser only ever holds an httpOnly session cookie made from the result.
 * Locally, FIREBASE_AUTH_EMULATOR_HOST points both this and firebase-admin at the Auth emulator.
 */
export const SESSION_COOKIE = "kc_session";
const SESSION_DAYS = 14; // the longest Identity Platform allows

export function auth() {
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  return getAuth(app);
}

/** The signed-in user from the session cookie, or null. Cached per request. */
export const currentUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const t = await auth().verifySessionCookie(cookie);
    return { id: t.uid, email: t.email ?? "" };
  } catch {
    return null;
  }
});

const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const TOOLKIT = emulator ? `http://${emulator}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1";

/** Calls an Identity Toolkit REST method. Errors come back as codes such as INVALID_LOGIN_CREDENTIALS. */
async function toolkit<T>(method: string, body: object): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    const res = await fetch(`${TOOLKIT}/${method}?key=${process.env.IDENTITY_PLATFORM_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: String(json?.error?.message ?? "UNKNOWN").split(" ")[0] };
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: "UNAVAILABLE" };
  }
}

/** Checks the password and starts a session. Returns the user id, or an Identity Toolkit error code. */
export async function signIn(email: string, password: string) {
  const r = await toolkit<{ idToken: string; localId: string }>("accounts:signInWithPassword", { email, password, returnSecureToken: true });
  if (!r.data) return { id: null, error: r.error };
  const session = await auth().createSessionCookie(r.data.idToken, { expiresIn: SESSION_DAYS * 86400 * 1000 });
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true, secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https") ?? false, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
  return { id: r.data.localId, error: null };
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(VAULT_COOKIE);
}

/** Checks a password without starting a session (for resetting the vault PIN). */
export async function passwordMatches(email: string, password: string) {
  const r = await toolkit("accounts:signInWithPassword", { email, password, returnSecureToken: false });
  return Boolean(r.data);
}

/**
 * The vault's locked section opens for 15 minutes after the PIN is checked. The cookie is signed by the
 * server and names the member; while it's valid, their database token says vault_unlocked, and RLS only
 * shows locked items to a token that says so.
 */
const VAULT_COOKIE = "kc_vault";
export const VAULT_MINUTES = 15;
const vaultSig = (body: string) => createHmac("sha256", `vault-unlock:${process.env.PGRST_JWT_SECRET}`).update(body).digest("base64url");

export async function unlockVault(userId: string) {
  const body = `${userId}.${Date.now() + VAULT_MINUTES * 60000}`;
  (await cookies()).set(VAULT_COOKIE, `${body}.${vaultSig(body)}`, {
    httpOnly: true, secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https") ?? false, sameSite: "strict", path: "/", maxAge: VAULT_MINUTES * 60,
  });
}

export async function lockVault() {
  (await cookies()).delete(VAULT_COOKIE);
}

export async function vaultUnlockedFor(userId: string) {
  const raw = (await cookies()).get(VAULT_COOKIE)?.value ?? "";
  const [uid, exp, sig] = raw.split(".");
  if (!uid || !exp || !sig || uid !== userId || Number(exp) < Date.now()) return false;
  const want = Buffer.from(vaultSig(`${uid}.${exp}`));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Emails a "set your password" link. Invites and resets both use it; the Identity Platform template is
 * worded for either, and its action URL is this site's /auth/action.
 */
export async function sendPasswordEmail(email: string) {
  return toolkit("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email });
}

/** The email a password link was sent to, without using the link up. Null if it's expired or used. */
export async function checkPasswordCode(oobCode: string) {
  const r = await toolkit<{ email: string }>("accounts:resetPassword", { oobCode });
  return r.data?.email ?? null;
}

/** Uses the link to set the password. Returns the account's email, or an error code. */
export async function setPasswordWithCode(oobCode: string, newPassword: string) {
  const r = await toolkit<{ email: string }>("accounts:resetPassword", { oobCode, newPassword });
  return r.data ? { email: r.data.email, error: null } : { email: null, error: r.error };
}
