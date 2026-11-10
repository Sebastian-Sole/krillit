"use server";

import { cleanName, currentPlayer, failDelay, normalizeCode, signInPlayer, signOutPlayer } from "@/lib/auth";
import { createPlayer, findPlayerByCode, findPlayerByName, upsertScore } from "@/lib/db";
import { parseShareText } from "@/lib/krillion-format";

export type SubmitState = { ok: boolean; message: string; dayNumber?: number } | null;
export type JoinState = { ok: false; message: string } | { ok: true; name: string; code: string } | null;

export async function submitScore(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const player = await currentPlayer();
  if (!player) return { ok: false, message: "Sign in first: pick your name or enter your sync code." };
  const text = String(form.get("result") ?? "");
  if (text.length > 2000) return { ok: false, message: "That's a lot of text. Paste just the Krillion result." };

  const parsed = parseShareText(text);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const { replaced } = await upsertScore(player.id, parsed, text.trim());
  return {
    ok: true,
    dayNumber: parsed.dayNumber,
    message: `${replaced ? "Updated" : "Added"} your ${parsed.score} for dive #${parsed.dayNumber}.`,
  };
}

/** New player: creates them, signs this device in, and hands back the sync code to show once. */
export async function joinAsNewPlayer(_prev: JoinState, form: FormData): Promise<JoinState> {
  const name = cleanName(String(form.get("name") ?? ""));
  if (!name) return { ok: false, message: "Use 1–30 letters, numbers, spaces, dots, apostrophes or dashes." };
  const taken = await findPlayerByName(name);
  if (taken) return { ok: false, message: `There's already a ${taken.name} here. If that's you, go back and pick “That's me”.` };
  const player = await createPlayer(name);
  if (!player) return { ok: false, message: `There's already a ${name} here. If that's you, go back and pick “That's me”.` };
  await signInPlayer(player.code);
  return { ok: true, name: player.name, code: player.code };
}

/** Returning player: their sync code signs this device in. `name`, if sent, must match the code. */
export async function signInWithCode(_prev: JoinState, form: FormData): Promise<JoinState> {
  const code = normalizeCode(String(form.get("code") ?? ""));
  const name = form.get("name");
  const player = await findPlayerByCode(code);
  if (!player || (typeof name === "string" && name && player.name.toLowerCase() !== name.toLowerCase())) {
    await failDelay();
    return { ok: false, message: "That code didn't match. Check it and try again, or ask the admin." };
  }
  await signInPlayer(player.code);
  return { ok: true, name: player.name, code: player.code };
}

export async function signOut() {
  await signOutPlayer();
}
