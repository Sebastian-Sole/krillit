"use client";

import { useState } from "react";
import { WEEKDAYS } from "@/lib/krillion-format";

type Cell = { avg: number | null; games: number };
type Row = { name: string; cells: Cell[]; best: number | null };

/** Average score per weekday, one row per player. Darker = higher. The outlined cell is that player's best day. */
export default function WeekdayHeatmap({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null);
  const vals = rows.flatMap((r) => r.cells.flatMap((c) => (c.avg == null ? [] : [c.avg])));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const t = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  return (
    <div className="chart">
      <div className="scroll-x">
      <table className="heat">
        <thead>
          <tr>
            <th />
            {WEEKDAYS.map((d) => (
              <th key={d} style={{ textAlign: "center" }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.name}>
              <td style={{ fontWeight: 550, whiteSpace: "nowrap", fontStyle: ri === rows.length - 1 && r.name === "Everyone" ? "italic" : undefined }}>
                {r.name}
              </td>
              {r.cells.map((c, ci) => {
                if (c.avg == null)
                  return (
                    <td key={ci} className="cell muted">
                      –
                    </td>
                  );
                const k = t(c.avg);
                return (
                  <td
                    key={ci}
                    className={`cell${r.best === ci ? " best" : ""}`}
                    style={{
                      background: `color-mix(in oklab, var(--seq-hi) ${Math.round(k * 100)}%, var(--seq-lo))`,
                      color: k > 0.5 ? "var(--on-hi)" : "var(--on-lo)",
                    }}
                    onMouseEnter={(e) => {
                      const box = e.currentTarget.getBoundingClientRect();
                      const host = e.currentTarget.closest(".chart")!.getBoundingClientRect();
                      setHover({ r: ri, c: ci, x: box.left - host.left + box.width / 2, y: box.top - host.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    {Math.round(c.avg)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="t-title">
            {rows[hover.r].name} · {WEEKDAYS[hover.c]}
          </div>
          <div className="t-row">
            Average <b>{Math.round(rows[hover.r].cells[hover.c].avg!)}</b>
          </div>
          <div className="t-row">
            Dives <b>{rows[hover.r].cells[hover.c].games}</b>
          </div>
        </div>
      )}
    </div>
  );
}
