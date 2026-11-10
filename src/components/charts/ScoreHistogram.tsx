"use client";

import { useState } from "react";
import { BUCKET_WIDTH, MAX_DAY_SCORE } from "@/lib/krillion-format";
import { seriesColor } from "./colors";

type Marker = { name: string; score: number; slot: number | null };

const W = 900;
const H = 240;
const M = { top: 46, right: 12, bottom: 28, left: 12 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
const x = (score: number) => M.left + (score / MAX_DAY_SCORE) * IW;

/** Krillion's worldwide score distribution for the day, with our players dropped on top. */
export default function ScoreHistogram({ dist, worldAvg, markers }: { dist: number[]; worldAvg: number | null; markers: Marker[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = dist.reduce((a, b) => a + b, 0);
  const max = Math.max(...dist);
  const bw = IW / dist.length;

  // Stagger labels that would collide.
  const sorted = [...markers].sort((a, b) => a.score - b.score);
  const rows: number[] = [];
  const lastX: number[] = [];
  for (const m of sorted) {
    const px = x(m.score);
    let row = 0;
    while (lastX[row] != null && px - lastX[row] < 70) row++;
    lastX[row] = px;
    rows.push(Math.min(row, 2));
  }

  return (
    <div className="chart">
      <div className="legend">
        <span>
          <span className="swatch-box" style={{ background: "var(--hist-bar)" }} /> Krillion players worldwide
        </span>
        {worldAvg != null && (
          <span>
            <span className="swatch-dash" /> Krillion average
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Worldwide score distribution with our scores marked">
        {dist.map((c, i) => {
          const h = max ? (c / max) * IH : 0;
          const bx = M.left + i * bw;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={bx} y={M.top} width={bw} height={IH} fill="transparent" />
              <path
                d={roundedTop(bx + 1, M.top + IH - h, bw - 2, h, 3)}
                fill="var(--hist-bar)"
                opacity={hover == null || hover === i ? 1 : 0.55}
              />
            </g>
          );
        })}
        <line x1={M.left} x2={W - M.right} y1={M.top + IH} y2={M.top + IH} stroke="var(--axis)" />
        {[0, 100, 200, 300, 400, 500, 600, 700].map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="tick">
            {t}
          </text>
        ))}
        {worldAvg != null && (
          <g pointerEvents="none">
            <line x1={x(worldAvg)} x2={x(worldAvg)} y1={M.top - 6} y2={M.top + IH} stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 4" />
            <text x={x(worldAvg) - 6} y={M.top + 8} textAnchor="end" className="tick" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">
              avg {Math.round(worldAvg)}
            </text>
          </g>
        )}
        {sorted.map((m, i) => {
          const px = x(m.score);
          const ly = 12 + rows[i] * 14;
          return (
            <g key={m.name} pointerEvents="none">
              <line x1={px} x2={px} y1={ly + 4} y2={M.top + IH} stroke={seriesColor(m.slot)} strokeWidth={2} />
              <circle cx={px} cy={M.top + IH} r={5} fill={seriesColor(m.slot)} stroke="var(--surface)" strokeWidth={2} />
              <text x={px} y={ly} textAnchor="middle" fontSize={12} fill="var(--ink)" fontWeight={600}>
                {m.name} {m.score}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${((M.left + (hover + 0.5) * bw) / W) * 100}%`, top: `${(M.top / H) * 100}%` }}>
          <div className="t-title">
            {Math.round(hover * BUCKET_WIDTH)}–{Math.round((hover + 1) * BUCKET_WIDTH)} points
          </div>
          <div className="t-row">
            Players <b>{dist[hover].toLocaleString()}</b>
          </div>
          <div className="t-row">
            Share <b>{((dist[hover] / total) * 100).toFixed(1)}%</b>
          </div>
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
