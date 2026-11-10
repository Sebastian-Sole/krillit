import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { allDays, allScores, listPlayers } from "@/lib/db";
import { syncToday } from "@/lib/krillion-sync";
import { WEEKDAYS, currentDayNumber, slotEmoji } from "@/lib/krillion-format";
import { PERIODS, PERIOD_LABELS, computeStats, playerSlot } from "@/lib/stats";
import { seriesColor } from "@/components/charts/colors";
import ScoreLineChart from "@/components/charts/ScoreLineChart";
import WeekdayHeatmap from "@/components/charts/WeekdayHeatmap";
import DepthChart from "@/components/charts/DepthChart";

export default function StatsPage() {
  return (
    <Suspense fallback={<p className="empty">Crunching…</p>}>
      <Stats />
    </Suspense>
  );
}

const signed = (v: number) =>
  `${v >= 0 ? "▲ +" : "▼ −"}${Math.abs(Math.round(v))}`;

async function Stats() {
  await connection();
  await syncToday();
  const [players, scores, days] = await Promise.all([listPlayers(), allScores(), allDays()]);
  const today = currentDayNumber();
  const { stats, worldAvg, groupWeekday } = computeStats(
    players,
    scores,
    days,
    today,
  );

  if (!stats.length) {
    return (
      <>
        <h1>Stats</h1>
        <p className="empty">
          No scores yet. <Link href="/">Add the first one</Link>.
        </p>
      </>
    );
  }

  const leader = stats[0];
  const mostWins = [...stats].sort((a, b) => b.wins - a.wins)[0];
  const bestGroupDay = groupWeekday.reduce(
    (best, w, i) =>
      w.avg != null && (best < 0 || w.avg > groupWeekday[best].avg!) ? i : best,
    -1,
  );
  const totalKrillions = stats.reduce((a, s) => a + s.slotCounts.krillion, 0);
  const best = (pick: (s: (typeof stats)[number]) => number | null) =>
    stats.reduce<number | null>((m, s) => {
      const v = pick(s);
      return v != null && (m == null || v > m) ? v : m;
    }, null);
  const bestAvg = Object.fromEntries(
    PERIODS.map((k) => [k, best((s) => s.periods[k].avg)]),
  );
  const bestDiff = Object.fromEntries(
    PERIODS.map((k) => [k, best((s) => s.periods[k].diff)]),
  );

  return (
    <>
      <h1>Stats</h1>
      <p className="sub">
        {scores.length} scores from {stats.length} players over{" "}
        {new Set(scores.map((s) => s.dayNumber)).size} dives
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="label">Best average</div>
          <div className="value">{leader.name}</div>
          <div className="note">
            {Math.round(leader.avg)} per dive over {leader.games}
          </div>
        </div>
        <div className="tile">
          <div className="label">Most daily wins</div>
          <div className="value">{mostWins.name}</div>
          <div className="note">{mostWins.wins} wins</div>
        </div>
        <div className="tile">
          <div className="label">Our best day</div>
          <div className="value">
            {bestGroupDay >= 0 ? WEEKDAYS[bestGroupDay] : "–"}
          </div>
          <div className="note">
            {bestGroupDay >= 0
              ? `averaging ${Math.round(groupWeekday[bestGroupDay].avg!)}`
              : ""}
          </div>
        </div>
        <div className="tile">
          <div className="label">One in a Krillion answers</div>
          <div className="value">{totalKrillions} 🌟</div>
          <div className="note">found by all of us</div>
        </div>
      </div>

      <section className="card">
        <h2>Averages</h2>
        <p className="sub">
          Avg diff is how far above (▲) or below (▼) Krillion&apos;s worldwide
          average you scored each day, averaged. Weeks start on Monday. Bold
          marks the best in each column.
        </p>
        <div className="scroll-x">
          <table className="periods">
            <thead>
              <tr>
                <th rowSpan={2}>Player</th>
                <th colSpan={3} className="group">
                  Avg score
                </th>
                <th colSpan={3} className="group">
                  Avg diff vs Krillion
                </th>
              </tr>
              <tr>
                {[...PERIODS, ...PERIODS].map((k, i) => (
                  <th key={i} className={`num${i === 3 ? " split" : ""}`}>
                    {PERIOD_LABELS[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="who">
                      <span
                        className="dot"
                        style={{
                          background: seriesColor(playerSlot(players, s.id)),
                        }}
                      />
                      {s.name}
                    </span>
                  </td>
                  {PERIODS.map((k) => {
                    const v = s.periods[k].avg;
                    return (
                      <td
                        key={k}
                        className="num"
                        title={`${s.periods[k].games} dives`}
                        style={{
                          fontWeight: v != null && v === bestAvg[k] ? 700 : 400,
                        }}
                      >
                        {v == null ? "–" : Math.round(v)}
                      </td>
                    );
                  })}
                  {PERIODS.map((k, i) => {
                    const v = s.periods[k].diff;
                    return (
                      <td
                        key={k}
                        className={`num${i === 0 ? " split" : ""} ${v == null ? "" : v >= 0 ? "delta-up" : "delta-down"}`}
                        title={`${s.periods[k].games} dives`}
                        style={{
                          fontWeight:
                            v != null && v === bestDiff[k] ? 700 : 400,
                        }}
                      >
                        {v == null ? "–" : signed(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Records</h2>
        <p className="sub">
          Beats is the average share of Krillion players you outscored. Ranked
          by all-time average.
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Player</th>
                <th className="num">Dives</th>
                <th className="num">Best</th>
                <th className="num">Wins</th>
                <th className="num">Beats</th>
                <th className="num">{slotEmoji("krillion")}</th>
                <th className="num">Streak</th>
                <th>Best day</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <span className="who">
                      <span
                        className="dot"
                        style={{
                          background: seriesColor(playerSlot(players, s.id)),
                        }}
                      />
                      {s.name}
                    </span>
                  </td>
                  <td className="num">{s.games}</td>
                  <td className="num">{s.best}</td>
                  <td className="num">{s.wins}</td>
                  <td className="num">
                    {s.avgPercentile == null
                      ? "–"
                      : `${Math.round(s.avgPercentile)}%`}
                  </td>
                  <td className="num">{s.slotCounts.krillion}</td>
                  <td className="num">{s.streak ? `${s.streak}🔥` : "–"}</td>
                  <td>
                    {s.bestWeekday != null ? WEEKDAYS[s.bestWeekday] : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Scores over time</h2>
        <p className="sub">Hover a name in the legend to pick out one player</p>
        <ScoreLineChart
          series={stats.map((s) => ({
            id: s.id,
            name: s.name,
            slot: playerSlot(players, s.id),
            points: scores
              .filter((x) => x.playerId === s.id)
              .map((x) => ({ day: x.dayNumber, score: x.score })),
          }))}
          world={[...worldAvg]
            .map(([day, avg]) => ({ day, avg }))
            .sort((a, b) => a.day - b.day)}
        />
      </section>

      <section className="card">
        <h2>Which day suits you?</h2>
        <p className="sub">
          Average score by weekday. Outlined: each player&apos;s best day.
        </p>
        <WeekdayHeatmap
          rows={[
            ...stats.map((s) => ({
              name: s.name,
              cells: s.weekday,
              best: s.bestWeekday,
            })),
            {
              name: "Everyone",
              cells: groupWeekday,
              best: bestGroupDay >= 0 ? bestGroupDay : null,
            },
          ]}
        />
      </section>

      <section className="card">
        <h2>How deep you dive</h2>
        <p className="sub">
          Average dive depth (1 point = 10 m, as in Krillion), split by how
          often you hit each tier
        </p>
        <DepthChart
          rows={stats.map((s) => ({
            id: s.id,
            name: s.name,
            avg: s.avg,
            counts: s.slotCounts,
          }))}
        />
      </section>
    </>
  );
}
