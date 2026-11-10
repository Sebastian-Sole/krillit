"use server";

import { checkAdminPassword, cleanName, failDelay, isAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { deleteScore, renamePlayer } from "@/lib/db";

export type AdminState = { ok: boolean; message: string } | null;
const DENIED: AdminState = { ok: false, message: "Your admin session has ended. Sign in again." };

export async function adminLogin(_prev: AdminState, form: FormData): Promise<AdminState> {
  if (!checkAdminPassword(String(form.get("password") ?? ""))) {
    await failDelay();
    return { ok: false, message: "Wrong password." };
  }
  await signInAdmin();
  return { ok: true, message: "Signed in." };
}

export async function adminLogout() {
  await signOutAdmin();
}

export async function adminRename(_prev: AdminState, form: FormData): Promise<AdminState> {
  if (!(await isAdmin())) return DENIED;
  const id = Number(form.get("id"));
  const name = cleanName(String(form.get("name") ?? ""));
  if (!Number.isInteger(id) || !name) return { ok: false, message: "Use 1–30 letters, numbers, spaces, dots, apostrophes or dashes." };
  if (!(await renamePlayer(id, name))) return { ok: false, message: `Someone else is already called ${name}.` };
  return { ok: true, message: `Renamed to ${name}.` };
}

export async function adminDeleteScore(_prev: AdminState, form: FormData): Promise<AdminState> {
  if (!(await isAdmin())) return DENIED;
  const playerId = Number(form.get("playerId"));
  const dayNumber = Number(form.get("dayNumber"));
  if (!Number.isInteger(playerId) || !Number.isInteger(dayNumber)) return { ok: false, message: "Pick a player and a dive number." };
  return (await deleteScore(playerId, dayNumber))
    ? { ok: true, message: `Deleted the score for dive #${dayNumber}.` }
    : { ok: false, message: `That player has no score for dive #${dayNumber}.` };
}
