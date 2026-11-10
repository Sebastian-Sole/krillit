"use client";

import { useState } from "react";
import { MAX_DAY_SCORE, dateFor, formatDate } from "@/lib/krillion-format";
import { seriesColor } from "./colors";

export type Series = { id: number; name: string; slot: number | null; points: { day: number; score: number }[] };

const W = 900;
const H = 300;
const M = { top: 12, right: 70, bottom: 28, left: 36 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

/** Everyone's daily score over time, against Krillion's worldwide average. */
export default function ScoreLineChart({ series, world }: { series: Series[]; world: { day: number; avg: number }[] }) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const days = [...new Set([...series.flatMap((s) => s.points.map((p) => p.day)), ...world.map((w) => w.day)])].sort((a, b) => a - b);
  if (days.length < 2) return <p className="empty">The trend appears once there are two days of scores.</p>;

  const d0 = days[0];
  const d1 = days[days.length - 1];
  const x = (d: number) => M.left + ((d - d0) / (d1 - d0)) * IW;
  const y = (v: number) => M.top + IH - (v / MAX_DAY_SCORE) * IH;
  const path = (pts: { day: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day)},${y(p.v)}`).join(" ");
  const directLabels = series.length <= 4;
  const xTicks = days.filter((_, i) => i % Math.ceil(days.length / 6) === 0);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const d = Math.round(d0 + ((px - M.left) / IW) * (d1 - d0));
    setHoverDay(Math.max(d0, Math.min(d1, d)));
  };

  const hoverRows =
    hoverDay == null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.day === hoverDay) }))
          .filter((r) => r.p)
          .sort((a, b) => b.p!.score - a.p!.score);
  const hoverWorld = world.find((w) => w.day === hoverDay);

  return (
    <div className="chart">
      <div className="legend">
        {series.map((s) => (
          <span key={s.id} onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)} style={{ cursor: "default" }}>
            <span className="swatch-line" style={{ borderColor: seriesColor(s.slot) }} /> {s.name}
          </span>
        ))}
        <span>
          <span className="swatch-dash" /> Krillion average
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHoverDay(null)} role="img" aria-label="Scores over time">
        {[0, 100, 200, 300, 400, 500, 600, 700].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + IW} y1={y(t)} y2={y(t)} stroke={t ? "var(--grid)" : "var(--axis)"} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="tick">
            {formatDate(dateFor(d), { day: "numeric", month: "short" })}
          </text>
        ))}
        {world.length > 1 && (
          <path d={path(world.map((w) => ({ day: w.day, v: w.avg })))} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" />
        )}
        {series.map((s) => {
          const dim = focus != null && focus !== s.id;
          const pts = s.points.map((p) => ({ day: p.day, v: p.score }));
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.id} opacity={dim ? 0.15 : 1}>
              <path d={path(pts)} fill="none" stroke={seriesColor(s.slot)} strokeWidth={2} strokeLinejoin="round" />
              {s.points.length <= 40 &&
                s.points.map((p) => (
                  <circle key={p.day} cx={x(p.day)} cy={y(p.score)} r={3.5} fill={seriesColor(s.slot)} stroke="var(--surface)" strokeWidth={1.5} />
                ))}
              {directLabels && last && (
                <text x={x(last.day) + 8} y={y(last.score) + 4} fontSize={12} fill="var(--ink-2)">
                  {s.name}
                </text>
              )}
            </g>
          );
        })}
        {hoverDay != null && (
          <g pointerEvents="none">
            <line x1={x(hoverDay)} x2={x(hoverDay)} y1={M.top} y2={M.top + IH} stroke="var(--axis)" />
            {hoverRows.map(({ s, p }) => (
              <circle key={s.id} cx={x(hoverDay)} cy={y(p!.score)} r={5} fill={seriesColor(s.slot)} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hoverDay != null && (hoverRows.length > 0 || hoverWorld) && (
        <div
          className="tooltip"
          style={{
            left: `${(x(hoverDay) / W) * 100}%`,
            top: `${(M.top / H) * 100}%`,
            transform: x(hoverDay) > W * 0.7 ? "translate(calc(-100% - 12px), 0)" : "translate(12px, 0)",
          }}
        >
          <div className="t-title">
            #{hoverDay} · {formatDate(dateFor(hoverDay))}
          </div>
          {hoverRows.map(({ s, p }) => (
            <div className="t-row" key={s.id}>
              <span className="dot" style={{ background: seriesColor(s.slot) }} /> {s.name} <b>{p!.score}</b>
            </div>
          ))}
          {hoverWorld && (
            <div className="t-row muted">
              Krillion avg <b>{Math.round(hoverWorld.avg)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
