import { randomBytes } from "node:crypto";
import { type NeonQueryFunction, neon } from "@neondatabase/serverless";
import type { Slot } from "./krillion-format.ts";

// Server-only. Postgres on Neon, over HTTP. DATABASE_URL comes from the Neon integration on Vercel;
// locally, `vercel env pull .env.local` fetches it. The schema lives in SCHEMA below and is applied by
// `npm run db:migrate`, which also runs before every Vercel build.

let client: NeonQueryFunction<false, false> | null = null;

/** Created on first use, so importing this file (e.g. during `next build`) never needs DATABASE_URL. */
function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` or add the Neon integration.");
    client = neon(url);
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values) as Promise<Record<string, unknown>[]>;
}

/** Creates any missing tables. Safe to run repeatedly. */
export async function migrate() {
  for (const statement of SCHEMA) await getClient().query(statement);
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
     id         SERIAL PRIMARY KEY,
     name       TEXT NOT NULL,
     code       TEXT NOT NULL UNIQUE,      -- sync code: the player's login (see lib/auth.ts)
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS players_name_ci ON players (lower(name))`,
  `CREATE TABLE IF NOT EXISTS scores (
     player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
     day_number   INTEGER NOT NULL,
     score        INTEGER NOT NULL,
     slots        JSONB NOT NULL,          -- 7 tier ids / "miss"
     raw          TEXT NOT NULL,
     submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (player_id, day_number)
   )`,
  // What Krillion published for a day. Krillion only exposes the current day,
  // so this table is the only record of past prompts and averages.
  `CREATE TABLE IF NOT EXISTS days (
     day_number INTEGER PRIMARY KEY,
     date       TEXT NOT NULL,
     prompts    JSONB,                     -- [{ text, gems: string[], answerCount }]
     dist       JSONB,                     -- 20 bucket counts over 0–700
     sample     INTEGER,                   -- number of Krillion players in dist
     fetched_at TIMESTAMPTZ NOT NULL
   )`,
];

// Unambiguous alphabet (no 0/O/1/I/L). 8 chars ≈ 30^8 ≈ 6.5e11 combinations.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LEN = 8;

function generateCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

export type Player = { id: number; name: string };
export type Member = Player & { code: string };
export type ScoreRow = { playerId: number; name: string; dayNumber: number; score: number; slots: Slot[]; submittedAt: string };
export type Prompt = { text: string; gems: string[]; answerCount: number };
/** fetchedAt is epoch milliseconds */
export type DayRow = { dayNumber: number; date: string; prompts: Prompt[] | null; dist: number[] | null; sample: number | null; fetchedAt: number };

export async function listPlayers(): Promise<Player[]> {
  return (await sql`SELECT id, name FROM players ORDER BY id`) as Player[];
}

export async function findPlayerByName(name: string): Promise<Player | null> {
  const rows = await sql`SELECT id, name FROM players WHERE lower(name) = lower(${name})`;
  return (rows[0] as Player | undefined) ?? null;
}

export async function findPlayerByCode(code: string): Promise<Member | null> {
  if (code.length !== CODE_LEN) return null;
  const rows = await sql`SELECT id, name, code FROM players WHERE code = ${code}`;
  return (rows[0] as Member | undefined) ?? null;
}

/** Everyone with their sync code. Admin only: never send codes to anyone but their owner. */
export async function listMembers(): Promise<Member[]> {
  return (await sql`SELECT id, name, code FROM players ORDER BY lower(name)`) as Member[];
}

/** Creates a player with a fresh sync code. Returns null if the name is taken (case-insensitive). */
export async function createPlayer(name: string): Promise<Member | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const rows = await sql`INSERT INTO players (name, code) VALUES (${name}, ${code}) RETURNING id`;
      return { id: rows[0].id as number, name, code };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      if (await findPlayerByName(name)) return null; // the name is taken; otherwise the code collided, so retry
    }
  }
  throw new Error("Couldn't generate a unique sync code");
}

/** Returns false if another player already has that name. */
export async function renamePlayer(id: number, name: string): Promise<boolean> {
  try {
    await sql`UPDATE players SET name = ${name} WHERE id = ${id}`;
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

export async function deleteScore(playerId: number, dayNumber: number): Promise<boolean> {
  const rows = await sql`DELETE FROM scores WHERE player_id = ${playerId} AND day_number = ${dayNumber} RETURNING 1`;
  return rows.length > 0;
}

export async function upsertScore(playerId: number, r: { dayNumber: number; score: number; slots: Slot[] }, raw: string) {
  // xmax = 0 only for freshly inserted rows, so it tells us whether this replaced an earlier paste.
  const rows = await sql`
    INSERT INTO scores (player_id, day_number, score, slots, raw)
    VALUES (${playerId}, ${r.dayNumber}, ${r.score}, ${JSON.stringify(r.slots)}::jsonb, ${raw})
    ON CONFLICT (player_id, day_number) DO UPDATE
      SET score = EXCLUDED.score, slots = EXCLUDED.slots, raw = EXCLUDED.raw, submitted_at = now()
    RETURNING (xmax <> 0) AS replaced`;
  return { replaced: Boolean(rows[0]?.replaced) };
}

export async function scoresForDay(dayNumber: number): Promise<ScoreRow[]> {
  return (await sql`
    SELECT s.player_id AS "playerId", p.name, s.day_number AS "dayNumber", s.score, s.slots, s.submitted_at::text AS "submittedAt"
    FROM scores s JOIN players p ON p.id = s.player_id
    WHERE s.day_number = ${dayNumber}
    ORDER BY s.score DESC, s.submitted_at`) as ScoreRow[];
}

export async function allScores(): Promise<ScoreRow[]> {
  return (await sql`
    SELECT s.player_id AS "playerId", p.name, s.day_number AS "dayNumber", s.score, s.slots, s.submitted_at::text AS "submittedAt"
    FROM scores s JOIN players p ON p.id = s.player_id
    ORDER BY s.day_number`) as ScoreRow[];
}

const toDay = (r: Record<string, unknown>) => ({ ...r, fetchedAt: Number(r.fetchedAt) }) as DayRow;

export async function getDay(dayNumber: number): Promise<DayRow | null> {
  const rows = await sql`
    SELECT day_number AS "dayNumber", date, prompts, dist, sample, (extract(epoch FROM fetched_at) * 1000)::bigint AS "fetchedAt"
    FROM days WHERE day_number = ${dayNumber}`;
  return rows[0] ? toDay(rows[0]) : null;
}

export async function allDays(): Promise<DayRow[]> {
  const rows = await sql`
    SELECT day_number AS "dayNumber", date, prompts, dist, sample, (extract(epoch FROM fetched_at) * 1000)::bigint AS "fetchedAt"
    FROM days ORDER BY day_number`;
  return rows.map(toDay);
}

/** Only overwrites the fields we actually got, so a failed fetch never erases what we had. */
export async function saveDay(d: { dayNumber: number; date: string; prompts?: Prompt[]; dist?: number[]; sample?: number }) {
  const prompts = d.prompts ? JSON.stringify(d.prompts) : null;
  const dist = d.dist ? JSON.stringify(d.dist) : null;
  await sql`
    INSERT INTO days (day_number, date, prompts, dist, sample, fetched_at)
    VALUES (${d.dayNumber}, ${d.date}, ${prompts}::jsonb, ${dist}::jsonb, ${d.sample ?? null}, now())
    ON CONFLICT (day_number) DO UPDATE SET
      prompts = COALESCE(EXCLUDED.prompts, days.prompts),
      dist = COALESCE(EXCLUDED.dist, days.dist),
      sample = COALESCE(EXCLUDED.sample, days.sample),
      fetched_at = EXCLUDED.fetched_at`;
}
