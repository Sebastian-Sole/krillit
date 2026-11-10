import Link from "next/link";
import { connection } from "next/server";
import { getDay, listPlayers, scoresForDay } from "@/lib/db";
import { syncToday } from "@/lib/krillion-sync";
import { SLOTS, type Slot, currentDayNumber, dateFor, distAverage, formatDate, percentileFor, slotEmoji, slotName } from "@/lib/krillion-format";
import { playerSlot } from "@/lib/stats";
import { seriesColor } from "./charts/colors";
import ScoreHistogram from "./charts/ScoreHistogram";
import SubmitForm from "./SubmitForm";

export default async function DayView({ dayNumber: requested }: { dayNumber?: number }) {
  await connection();
  const today = currentDayNumber();
  const dayNumber = requested ?? today;
  const isToday = dayNumber === today;
  if (isToday) await syncToday();

  const [day, scores, players] = await Promise.all([getDay(dayNumber), scoresForDay(dayNumber), listPlayers()]);
  const worldAvg = day?.dist ? distAverage(day.dist) : null;
  const groupAvg = scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : null;
  const date = day?.date ?? dateFor(dayNumber);

  return (
    <>
      <div className="day-head">
        <div>
          <h1>Dive #{dayNumber}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {isToday && " · today"}
          </p>
        </div>
        <div className="pager">
          {dayNumber > 1 ? <Link href={`/day/${dayNumber - 1}`}>← Prev</Link> : <span>← Prev</span>}
          {dayNumber < today ? <Link href={dayNumber + 1 === today ? "/" : `/day/${dayNumber + 1}`}>Next →</Link> : <span>Next →</span>}
        </div>
      </div>

      {isToday && <SubmitForm dayNumber={dayNumber} />}

      <div className="tiles">
        <div className="tile">
          <div className="label">Our average</div>
          <div className="value">{groupAvg != null ? Math.round(groupAvg) : "–"}</div>
          <div className="note">
            {scores.length} {scores.length === 1 ? "player" : "players"}
          </div>
        </div>
        <div className="tile">
          <div className="label">Krillion average</div>
          <div className="value">{worldAvg != null ? Math.round(worldAvg) : "–"}</div>
          <div className="note">{day?.sample ? `${day.sample.toLocaleString()} divers worldwide` : "not captured for this day"}</div>
        </div>
        <div className="tile">
          <div className="label">Top score</div>
          <div className="value">{scores[0]?.score ?? "–"}</div>
          <div className="note">{scores[0] ? scores.filter((s) => s.score === scores[0].score).map((s) => s.name).join(", ") : "no scores yet"}</div>
        </div>
      </div>

      <section className="card">
        <h2>Leaderboard</h2>
        {scores.length === 0 ? (
          <p className="empty">No scores yet{isToday ? ". Be the first." : "."}</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Player</th>
                  <th>Answers</th>
                  <th className="num">Score</th>
                  <th className="num">vs Krillion avg</th>
                  <th className="num">Beat</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => {
                  const rank = scores.findIndex((o) => o.score === s.score) + 1;
                  const delta = worldAvg != null ? s.score - worldAvg : null;
                  const pct = day?.dist ? percentileFor(s.score, day.dist) : null;
                  return (
                    <tr key={s.playerId}>
                      <td className="rank">{rank}</td>
                      <td>
                        <span className="who">
                          <span className="dot" style={{ background: seriesColor(playerSlot(players, s.playerId)) }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="emojis" title={s.slots.map(slotName).join(" · ")}>
                        {s.slots.map(slotEmoji).join("")}
                      </td>
                      <td className="num">
                        <b>{s.score}</b>
                      </td>
                      <td className={`num ${delta == null ? "" : delta >= 0 ? "delta-up" : "delta-down"}`}>
                        {delta == null ? "–" : `${delta >= 0 ? "▲ +" : "▼ −"}${Math.abs(Math.round(delta))}`}
                      </td>
                      <td className="num">{pct == null ? "–" : `${Math.round(pct)}% of divers`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {day?.dist && (
        <section className="card">
          <h2>Where we landed</h2>
          <p className="sub">Everyone who played Krillion today, by score</p>
          <ScoreHistogram
            dist={day.dist}
            worldAvg={worldAvg}
            markers={scores.map((s) => ({ name: s.name, score: s.score, slot: playerSlot(players, s.playerId) }))}
          />
        </section>
      )}

      <section className="card">
        <h2>The prompts</h2>
        {!day?.prompts ? (
          <p className="empty">Prompts weren&apos;t captured for this day. Krillion only shares the current day&apos;s prompts.</p>
        ) : (
          <details open={!isToday}>
            <summary>{isToday ? "Show today's prompts and how we did (spoilers if you haven't played)" : "Hide"}</summary>
            <ol className="prompts" style={{ marginTop: 8 }}>
              {day.prompts.map((p, i) => {
                const best = Math.max(...scores.map((s) => slotRank(s.slots[i])), -1);
                return (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    <span className="prompt-text">{p.text}</span>
                    {scores.length > 0 && (
                      <span className="prompt-meta">
                        {scores.map((s) => (
                          <span key={s.playerId} className="chip" title={slotName(s.slots[i])} style={{ fontWeight: slotRank(s.slots[i]) === best && best > 0 ? 700 : 400 }}>
                            {slotEmoji(s.slots[i])} {s.name}
                          </span>
                        ))}
                      </span>
                    )}
                    {p.gems.length > 0 && (
                      <span className="gems">
                        🌟 One in a Krillion: {p.gems.join(", ")}
                        {p.answerCount > 0 && ` · ${p.answerCount.toLocaleString()} accepted answers`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        )}
      </section>
    </>
  );
}

const slotRank = (s: Slot) => SLOTS.indexOf(s);
