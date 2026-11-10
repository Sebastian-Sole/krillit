// Fills a database with 6 weeks of made-up scores so the charts have something to show.
// Only ever touches DEMO_DATABASE_URL, never the real database. Run via `npm run demo`.
import { createPlayer, migrate, saveDay, sql, upsertScore } from "../src/lib/db.ts";
import { SLOTS, type Slot, currentDayNumber, dateFor, slotEmoji, slotScore, weekdayIndex } from "../src/lib/krillion-format.ts";

if (!process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL !== process.env.DEMO_DATABASE_URL) {
  console.error("Refusing to seed: this script only writes to DEMO_DATABASE_URL. Use `npm run demo`.");
  process.exit(1);
}

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

// skill shifts answers toward rarer tiers; weekday bonus gives everyone a "good day".
const players = [
  { name: "Ana", skill: 0.62, goodDay: 4, playRate: 0.95 },
  { name: "Ben", skill: 0.48, goodDay: 0, playRate: 0.85 },
  { name: "Chidi", skill: 0.55, goodDay: 2, playRate: 0.9 },
  { name: "Dana", skill: 0.4, goodDay: 5, playRate: 0.7 },
  { name: "Eli", skill: 0.52, goodDay: 1, playRate: 0.8 },
  { name: "Fay", skill: 0.45, goodDay: 3, playRate: 0.75 },
];

const today = currentDayNumber();
const baseDist = [884, 3416, 14006, 25549, 60945, 83668, 121284, 148934, 152775, 112080, 101896, 74761, 31553, 17080, 11945, 3142, 2059, 1126, 343, 59];

await migrate();
await sql`DELETE FROM scores`;
await sql`DELETE FROM players`;
await sql`DELETE FROM days WHERE prompts IS NULL`;
const ids = new Map<string, number>();
for (const p of players) ids.set(p.name, (await createPlayer(p.name))!.id);

for (let day = today - 42; day < today; day++) {
  // Shift the worldwide histogram a bucket either way so the average moves day to day.
  const shift = Math.floor(rand() * 3) - 1;
  const dist = baseDist.map((_, i) => Math.round(baseDist[Math.min(19, Math.max(0, i - shift))] * (0.8 + rand() * 0.4)));
  await saveDay({ dayNumber: day, date: dateFor(day), dist, sample: dist.reduce((a, b) => a + b, 0) });

  const hard = rand() * 0.15;
  for (const p of players) {
    if (rand() > p.playRate) continue;
    const bonus = weekdayIndex(dateFor(day)) === p.goodDay ? 0.12 : 0;
    const slots: Slot[] = Array.from({ length: 7 }, () => {
      if (rand() < 0.06) return "miss";
      const depth = Math.min(0.999, Math.max(0, p.skill + bonus - hard + (rand() - 0.5) * 0.7));
      return SLOTS[1 + Math.floor(depth * 6)];
    });
    const score = slots.reduce((a, s) => a + slotScore(s), 0);
    await upsertScore(ids.get(p.name)!, { dayNumber: day, score, slots }, `Krillion #${day} 🦐 ${score}  ${slots.map(slotEmoji).join("")}`);
  }
}
console.log(`Seeded ${players.length} players across days ${today - 42}–${today - 1} into the demo database`);
