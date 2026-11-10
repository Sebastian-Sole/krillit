import { getDay, saveDay, type Prompt } from "./db.ts";
import { DIST_BUCKETS, currentDayNumber, dateFor } from "./krillion-format.ts";

// Krillion has no official API. These are the public endpoints its own web client calls.
// They only ever describe *today*, so we snapshot them into our `days` table as we go.
const BASE = "https://krillion.io";
const REFRESH_MS = 10 * 60_000;
const HEADERS = { "User-Agent": "krillit (private friends leaderboard)" };

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init?.headers }, signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Today = { date: string; dayNumber: number; prompts: { id: string; text: string }[] };
type Reveal = { prompts: { id: string; answers: { answer: string; tier: string }[] }[] };
type Complete = { sample: number; dist: number[] };

let inFlight: Promise<void> | null = null;
let lastAttempt = 0;

/** Refreshes today's prompts, gem answers and worldwide score distribution, at most every 10 minutes. */
export async function syncToday(force = false): Promise<void> {
  const existing = force ? null : await getDay(currentDayNumber());
  const fresh = existing?.prompts && existing.dist && Date.now() - existing.fetchedAt < REFRESH_MS;
  // If krillion.io is down, don't make every page view wait on a timeout.
  if (!force && (fresh || Date.now() - lastAttempt < 60_000)) return;
  lastAttempt = Date.now();
  inFlight ??= doSync().finally(() => (inFlight = null));
  return inFlight;
}

async function doSync() {
  const today = await getJson<Today>(`${BASE}/api/today`);
  if (!today) return;

  const [reveal, complete] = await Promise.all([
    getJson<Reveal>(`${BASE}/api/reveal?date=${today.date}`),
    // The same call Krillion's results screen makes. record:false means it isn't counted as a play.
    getJson<Complete>(`${BASE}/api/today/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today.date, playerId: "krillit-readonly", score: 0, record: false }),
    }),
  ]);

  const prompts: Prompt[] = today.prompts.map((p) => {
    const answers = reveal?.prompts.find((r) => r.id === p.id)?.answers ?? [];
    return { text: p.text, gems: answers.filter((a) => a.tier === "krillion").map((a) => a.answer).slice(0, 5), answerCount: answers.length };
  });
  const dist = Array.isArray(complete?.dist) && complete.dist.length === DIST_BUCKETS ? complete.dist : undefined;

  // Without the reveal we'd lose the gem answers we already stored, so keep the old prompts.
  const keepOld = !reveal && (await getDay(today.dayNumber))?.prompts;
  await saveDay({
    dayNumber: today.dayNumber,
    date: today.date ?? dateFor(today.dayNumber),
    prompts: keepOld ? undefined : prompts,
    dist,
    sample: dist ? complete?.sample : undefined,
  });
}
