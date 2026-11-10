import type { Slot } from "@/lib/krillion-format";

export const seriesColor = (slot: number | null) => (slot ? `var(--series-${slot})` : "var(--series-other)");
export const tierColor = (s: Slot) => `var(--tier-${s})`;
