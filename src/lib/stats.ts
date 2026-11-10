import type { DayRow, Player, ScoreRow } from "./db.ts";
import { SLOTS, type Slot, dateFor, dayNumberFor, distAverage, percentileFor, weekdayIndex } from "./krillion-format.ts";

// Player colours follow join order and never change; only the first 8 players get a hue.
export const PLAYER_COLORS = 8;
export function playerSlot(players: Player[], playerId: number): number | null {
  const i = players.findIndex((p) => p.id === playerId);
  return i >= 0 && i < PLAYER_COLORS ? i + 1 : null;
}

export const PERIODS = ["week", "month", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = { week: "This week", month: "This month", all: "All time" };

/** avg = mean score; diff = mean of (score − Krillion's average that day), over days we have that average for */
export type PeriodStats = { avg: number | null; diff: number | null; games: number };

/** First dive number of the current calendar week (Monday) and month. */
export function periodStarts(today: number): Record<Period, number> {
  const date = dateFor(today);
  return { week: today - weekdayIndex(date), month: dayNumberFor(`${date.slice(0, 7)}-01`), all: 1 };
}

export type PlayerStats = {
  id: number;
  name: string;
  games: number;
  avg: number;
  best: number;
  wins: number;
  avgPercentile: number | null;
  slotCounts: Record<Slot, number>;
  weekday: { avg: number | null; games: number }[];
  bestWeekday: number | null;
  streak: number;
  periods: Record<Period, PeriodStats>;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeStats(players: Player[], scores: ScoreRow[], days: DayRow[], today: number) {
  const dayInfo = new Map(days.map((d) => [d.dayNumber, d]));
  const worldAvg = new Map<number, number>();
  for (const d of days) {
    const a = d.dist && distAverage(d.dist);
    if (a != null) worldAvg.set(d.dayNumber, a);
  }

  const topByDay = new Map<number, number>();
  for (const s of scores) topByDay.set(s.dayNumber, Math.max(topByDay.get(s.dayNumber) ?? 0, s.score));

  const stats: PlayerStats[] = players
    .map((p): PlayerStats | null => {
      const mine = scores.filter((s) => s.playerId === p.id);
      if (!mine.length) return null;
      const pcts = mine.flatMap((s) => {
        const dist = dayInfo.get(s.dayNumber)?.dist;
        const pct = dist ? percentileFor(s.score, dist) : null;
        return pct == null ? [] : [pct];
      });
      const slotCounts = Object.fromEntries(SLOTS.map((k) => [k, 0])) as Record<Slot, number>;
      for (const s of mine) for (const slot of s.slots) slotCounts[slot]++;

      const byWd = Array.from({ length: 7 }, () => [] as number[]);
      for (const s of mine) byWd[weekdayIndex(dateFor(s.dayNumber))].push(s.score);
      const weekday = byWd.map((xs) => ({ avg: mean(xs), games: xs.length }));
      let bestWeekday: number | null = null;
      for (let i = 0; i < 7; i++) {
        const a = weekday[i].avg;
        if (a != null && (bestWeekday == null || a > weekday[bestWeekday].avg!)) bestWeekday = i;
      }

      const played = new Set(mine.map((s) => s.dayNumber));
      // A streak still counts if today's score isn't in yet.
      let d = played.has(today) ? today : today - 1;
      let streak = 0;
      while (played.has(d)) {
        streak++;
        d--;
      }

      const starts = periodStarts(today);
      const periods = Object.fromEntries(
        PERIODS.map((k) => {
          const inPeriod = mine.filter((s) => s.dayNumber >= starts[k]);
          const diffs = inPeriod.flatMap((s) => (worldAvg.has(s.dayNumber) ? [s.score - worldAvg.get(s.dayNumber)!] : []));
          return [k, { avg: mean(inPeriod.map((s) => s.score)), diff: mean(diffs), games: inPeriod.length }];
        }),
      ) as Record<Period, PeriodStats>;

      return {
        periods,
        id: p.id,
        name: p.name,
        games: mine.length,
        avg: mean(mine.map((s) => s.score))!,
        best: Math.max(...mine.map((s) => s.score)),
        wins: mine.filter((s) => s.score === topByDay.get(s.dayNumber)).length,
        avgPercentile: mean(pcts),
        slotCounts,
        weekday,
        bestWeekday,
        streak,
      };
    })
    .filter((s): s is PlayerStats => s !== null)
    .sort((a, b) => b.avg - a.avg);

  const groupWeekday = Array.from({ length: 7 }, (_, i) => {
    const xs = scores.filter((s) => weekdayIndex(dateFor(s.dayNumber)) === i).map((s) => s.score);
    return { avg: mean(xs), games: xs.length };
  });

  return { stats, worldAvg, groupWeekday };
}
