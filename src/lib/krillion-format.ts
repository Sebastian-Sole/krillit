// Everything we know about Krillion's daily format, mirrored from krillion.io's client bundle.
// Safe to import from both server and client code.

export const TIER_IDS = ["plankton", "tooclever", "schooler", "rare", "deepcut", "krillion"] as const;
export type TierId = (typeof TIER_IDS)[number];
export type Slot = TierId | "miss";

export const TIERS: Record<TierId, { name: string; score: number; emoji: string }> = {
  plankton: { name: "Plankton", score: 10, emoji: "🫧" },
  tooclever: { name: "Too Clever", score: 15, emoji: "🤡" },
  schooler: { name: "Schooler", score: 30, emoji: "🐟" },
  rare: { name: "Rare", score: 60, emoji: "🦑" },
  deepcut: { name: "Deep Cut", score: 85, emoji: "🏮" },
  krillion: { name: "One in a Krillion", score: 100, emoji: "🌟" },
};
export const MISS_EMOJI = "⬛";
export const SLOTS: Slot[] = ["miss", ...TIER_IDS];
export const ROUNDS_PER_DAY = 7;
export const MAX_DAY_SCORE = 700;

export function slotEmoji(s: Slot): string {
  return s === "miss" ? MISS_EMOJI : TIERS[s].emoji;
}
export function slotName(s: Slot): string {
  return s === "miss" ? "Miss" : TIERS[s].name;
}
export function slotScore(s: Slot): number {
  return s === "miss" ? 0 : TIERS[s].score;
}

const EMOJI_TO_SLOT = new Map<string, Slot>([
  [MISS_EMOJI, "miss"],
  ...TIER_IDS.map((t) => [TIERS[t].emoji, t] as [string, Slot]),
]);

// Krillion's day 1 was 2026-07-16; days roll over at midnight New York time.
const EPOCH = Date.UTC(2026, 6, 16);
const DAY_MS = 86_400_000;
export const KRILLION_TZ = "America/New_York";

export function todayDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KRILLION_TZ }).format(now);
}
export function dayNumberFor(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - EPOCH) / DAY_MS) + 1;
}
export function dateFor(dayNumber: number): string {
  return new Date(EPOCH + (dayNumber - 1) * DAY_MS).toISOString().slice(0, 10);
}
export function currentDayNumber(now = new Date()): number {
  return dayNumberFor(todayDate(now));
}
/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export type ParsedResult = { dayNumber: number; score: number; slots: Slot[] };

/**
 * Parses the text Krillion copies to the clipboard. The share sheet spreads it over several lines:
 *   Krillion #118 🦐
 *   310
 *
 *   🦑🐟🦑🐟🦑🫧🦑
 * The single-line form ("Krillion #118 🦐 310  🦑🐟…  https://krillion.io") and surrounding chat
 * text are accepted too. Archive (⟲) and Unlimited (∞) dives are rejected: only the Daily Dive counts.
 */
export function parseShareText(text: string): ParsedResult | { error: string } {
  const at = text.search(/krillion\s*(⟲|∞)?\s*#\s*\d+/iu);
  if (at < 0) return { error: "Couldn't find a Krillion result in that. Paste the text from Krillion's share button." };
  const from = text.slice(at);
  if (/^krillion\s*(⟲|∞)/iu.test(from)) return { error: "That's an Archive or Unlimited dive. Only the Daily Dive counts." };

  const m = from.match(/^krillion\s*#\s*(\d+)\s*🦐?\s*(\d+)([\s\S]*)$/iu);
  if (!m) return { error: "That doesn't look like a Daily Dive result (expected “Krillion #123 🦐 345” and 7 emojis)." };

  const dayNumber = Number(m[1]);
  const score = Number(m[2]);
  const slots: Slot[] = [];
  for (const ch of m[3].replace(/\uFE0F/g, "")) {
    if (/\s/u.test(ch)) continue;
    const s = EMOJI_TO_SLOT.get(ch);
    if (!s || slots.length === ROUNDS_PER_DAY) break;
    slots.push(s);
  }
  if (slots.length !== ROUNDS_PER_DAY) return { error: `Expected ${ROUNDS_PER_DAY} answer emojis, found ${slots.length}.` };
  if (score > MAX_DAY_SCORE) return { error: `Scores top out at ${MAX_DAY_SCORE}.` };
  if (dayNumber < 1 || dayNumber > currentDayNumber() + 1) return { error: `Dive #${dayNumber} hasn't happened yet.` };
  return { dayNumber, score, slots };
}

// Krillion publishes the day's score histogram as 20 equal buckets over 0–700.
export const DIST_BUCKETS = 20;
export const BUCKET_WIDTH = MAX_DAY_SCORE / DIST_BUCKETS;

export function distAverage(dist: number[]): number | null {
  const n = dist.reduce((a, b) => a + b, 0);
  if (!n) return null;
  return dist.reduce((sum, c, i) => sum + c * (i + 0.5) * BUCKET_WIDTH, 0) / n;
}

/** Share of Krillion players who scored below `score` (0–100), interpolating inside a bucket. */
export function percentileFor(score: number, dist: number[]): number | null {
  const n = dist.reduce((a, b) => a + b, 0);
  if (!n) return null;
  const idx = Math.min(DIST_BUCKETS - 1, Math.floor(score / BUCKET_WIDTH));
  let below = 0;
  for (let i = 0; i < idx; i++) below += dist[i];
  below += dist[idx] * ((score - idx * BUCKET_WIDTH) / BUCKET_WIDTH);
  return (below / n) * 100;
}
