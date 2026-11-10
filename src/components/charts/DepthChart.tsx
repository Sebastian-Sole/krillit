"use client";

import { useState } from "react";
import { SLOTS, type Slot, slotEmoji, slotName } from "@/lib/krillion-format";
import { tierColor } from "./colors";

type Row = { id: number; name: string; avg: number; counts: Record<Slot, number> };

const H = 380;
const M = { top: 40, right: 16, bottom: 30, left: 64 };
const IH = H - M.top - M.bottom;
const GAP = 2;

/**
 * Each player sinks as deep as their average dive (Krillion counts 1 point as 10 m).
 * The column is split by the share of answers per tier, shallowest at the surface, deepest at the bottom.
 */
export default function DepthChart({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<{ row: number; slot: Slot } | null>(null);
  const W = Math.max(520, M.left + M.right + rows.length * 96);
  const IW = W - M.left - M.right;
  const maxDepth = Math.max(1000, Math.ceil(Math.max(...rows.map((r) => r.avg * 10)) / 1000) * 1000);
  const y = (m: number) => M.top + (m / maxDepth) * IH;
  const step = IW / rows.length;
  const colW = Math.min(52, step * 0.6);
  const ticks = Array.from({ length: maxDepth / 1000 + 1 }, (_, i) => i * 1000);

  const h = hover && rows[hover.row];
  const hTotal = h ? SLOTS.reduce((a, s) => a + h.counts[s], 0) : 0;

  return (
    <div className="chart depth">
      <div className="legend depth-legend">
        {SLOTS.map((s) => (
          <span key={s}>
            <span className="swatch-box" style={{ background: tierColor(s) }} /> {slotEmoji(s)} {slotName(s)}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average dive depth per player, split by answer tier">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t ? "rgba(232,241,255,0.08)" : "rgba(232,241,255,0.45)"} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="rgba(232,241,255,0.55)">
              {t ? `${t.toLocaleString()} m` : "surface"}
            </text>
          </g>
        ))}
        {rows.map((r, ri) => {
          const total = SLOTS.reduce((a, s) => a + r.counts[s], 0);
          const cx = M.left + step * (ri + 0.5);
          const x0 = cx - colW / 2;
          const len = y(r.avg * 10) - M.top;
          const shown = SLOTS.filter((s) => r.counts[s] > 0);
          let cursor = M.top;
          return (
            <g key={r.id}>
              <text x={cx} y={M.top - 10} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--foam)">
                {r.name}
              </text>
              {shown.map((s, si) => {
                const segH = total ? (r.counts[s] / total) * len : 0;
                const top = cursor;
                cursor += segH;
                const last = si === shown.length - 1;
                const drawH = Math.max(0, segH - (last ? 0 : GAP));
                const active = !hover || (hover.row === ri && hover.slot === s);
                return (
                  <g key={s} onMouseEnter={() => setHover({ row: ri, slot: s })} onMouseLeave={() => setHover(null)}>
                    <rect x={x0 - 6} y={top} width={colW + 12} height={segH} fill="transparent" />
                    <path d={last ? roundedBottom(x0, top, colW, drawH, 4) : rect(x0, top, colW, drawH)} fill={tierColor(s)} opacity={active ? 1 : 0.6} />
                    {drawH >= 18 && (
                      <text x={cx} y={top + drawH / 2 + 5} textAnchor="middle" fontSize={13} pointerEvents="none">
                        {slotEmoji(s)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={cx} y={M.top + len + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foam)">
                {Math.round(r.avg * 10).toLocaleString()} m
              </text>
            </g>
          );
        })}
      </svg>
      {h && hover && (
        <div
          className="tooltip"
          style={{
            left: `${((M.left + step * (hover.row + 0.5)) / W) * 100}%`,
            top: `${(M.top / H) * 100}%`,
            transform: "translate(-50%, 8px)",
          }}
        >
          <div className="t-title">
            {h.name} · {slotEmoji(hover.slot)} {slotName(hover.slot)}
          </div>
          <div className="t-row">
            Answers <b>{h.counts[hover.slot]}</b>
          </div>
          <div className="t-row">
            Share <b>{hTotal ? Math.round((h.counts[hover.slot] / hTotal) * 100) : 0}%</b>
          </div>
          <div className="t-row muted">
            Average dive <b>{Math.round(h.avg * 10).toLocaleString()} m</b>
          </div>
        </div>
      )}
    </div>
  );
}

const rect = (x: number, y: number, w: number, h: number) => `M${x},${y} h${w} v${h} h${-w} Z`;

function roundedBottom(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y} H${x + w} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x + rr} Q${x},${y + h} ${x},${y + h - rr} Z`;
}
