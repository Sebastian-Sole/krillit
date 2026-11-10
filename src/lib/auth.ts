import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findPlayerByCode, type Member } from "./db.ts";

/**
 * Two light-weight logins, both server-side only.
 *
 * Players: trust-based, no passwords. Each player has an 8-character sync code
 * (lib/db.ts). Signing in stores that code in an httpOnly cookie; the server looks
 * the player up by it on every request. To use another device, enter the code there.
 *
 * Admin: one shared password in ADMIN_PASSWORD. A correct login sets an httpOnly
 * cookie holding an expiry signed with HMAC (key: ADMIN_SESSION_SECRET, else the
 * password), so the password itself never leaves the server.
 */

export const PLAYER_COOKIE = "krillit_player";
export const ADMIN_COOKIE = "krillit_admin";
const YEAR = 60 * 60 * 24 * 365;
const ADMIN_MAX_AGE = 60 * 60 * 24 * 30;

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge }) as const;

const NAME_RE = /^[\p{L}\p{M}\p{N} .'-]+$/u;

/** Trims and collapses spaces; returns null if the name isn't 1–30 letters, digits, spaces or .'- */
export function cleanName(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 30 && NAME_RE.test(n) ? n : null;
}

/** Uppercases and strips spaces/dashes, so "ab12-cd34" matches "AB12CD34". */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Slows down repeated guessing of sync codes or the admin password. */
export const failDelay = () => new Promise((r) => setTimeout(r, 300));

export async function currentPlayer(): Promise<Member | null> {
  const code = (await cookies()).get(PLAYER_COOKIE)?.value;
  return code ? findPlayerByCode(normalizeCode(code)) : null;
}

export async function signInPlayer(code: string) {
  (await cookies()).set(PLAYER_COOKIE, code, cookieOptions(YEAR));
}

export async function signOutPlayer() {
  (await cookies()).delete(PLAYER_COOKIE);
}

// --- admin ---

function hmacKey(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(expMs: number): string {
  return createHmac("sha256", hmacKey()).update(String(expMs)).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && safeEqual(input, pw!);
}

export async function signInAdmin() {
  const exp = Date.now() + ADMIN_MAX_AGE * 1000;
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(exp)}`, cookieOptions(ADMIN_MAX_AGE));
}

export async function signOutAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp > Date.now() && Boolean(mac) && safeEqual(mac, sign(exp));
}
