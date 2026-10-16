import { createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";

/**
 * Sign-in for /admin: one account (the owner), email and password.
 *
 * Environment:
 *  - ADMIN_EMAIL: the owner's email (defaults to her address)
 *  - ADMIN_PASSWORD_HASH: `scrypt:<salt>:<hash>`, made by `npm run admin:password` (the password itself
 *    is never stored anywhere)
 *  - AUTH_SECRET: a long random string that signs the session cookie
 *
 * A successful sign-in sets an httpOnly, signed cookie good for 7 days. Its signature also covers the
 * password hash, so changing the password signs out every open session. Wrong attempts are limited to
 * 5 per 15 minutes per IP address.
 */

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "wouroudelkhaldi@gmail.com").trim().toLowerCase();
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";
const SECRET = process.env.AUTH_SECRET ?? "";

export const authConfigured = SECRET.length >= 32 && PASSWORD_HASH.startsWith("scrypt:");

const COOKIE = "wc_admin";
const MAX_AGE = 7 * 24 * 60 * 60;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

function sign(expires: number) {
  return createHmac("sha256", SECRET).update(`${ADMIN_EMAIL}|${PASSWORD_HASH}|${expires}`).digest("base64url");
}

function equal(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

async function passwordMatches(password: string) {
  const [, salt, hash] = PASSWORD_HASH.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length);
  return equal(actual, expected);
}

const attempts = new Map<string, number[]>();
function tooManyAttempts(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  attempts.set(ip, recent);
  return recent.length >= 5;
}

/** Checks the email and password; on success sets the session cookie. Returns an error message or null. */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!authConfigured) return "Sign-in isn't set up yet (ADMIN_PASSWORD_HASH and AUTH_SECRET).";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooManyAttempts(ip)) return "Too many tries. Wait 15 minutes and try again.";
  const emailOk = equal(Buffer.from(email.trim().toLowerCase()), Buffer.from(ADMIN_EMAIL));
  // Always run the slow hash, so a wrong email takes as long as a wrong password.
  const passwordOk = await passwordMatches(password.slice(0, 200));
  if (!emailOk || !passwordOk) {
    attempts.get(ip)!.push(Date.now());
    return "Wrong email or password.";
  }
  attempts.delete(ip);
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });
  return null;
}

export async function signOutAdmin() {
  (await cookies()).delete(COOKIE);
}

/** True when the current request carries the owner's valid session cookie. */
export async function isAdmin() {
  if (!authConfigured) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, signature] = value.split(".");
  const expires = Number(exp);
  if (!signature || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return equal(Buffer.from(signature), Buffer.from(sign(expires)));
}
