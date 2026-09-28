"use client";

import { Panel } from "./Panel";
import { formatCount, percentOf } from "../lib/overview-math";
import { useDecisionShare } from "../hooks/useStatsV2";

export const DECISIONS = [
    { bucket: "direct play", label: "Direct Play", color: "#22c55e" },
    { bucket: "transcode", label: "Transcode", color: "#8b5cf6" },
    { bucket: "direct stream", label: "Direct Stream", color: "#60a5fa" },
] as const;

const RADIUS = 56;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Hairline gap between arcs, like the reference design. */
const GAP = 3;

export function StreamDecisionPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const share = useDecisionShare(days, serverId);
    const total = share.reduce((sum, r) => sum + r.total, 0);
    const rows = DECISIONS.map((d) => {
        const count = share.find((r) => r.bucket === d.bucket)?.total ?? 0;
        return { ...d, count, percent: percentOf(count, total) };
    });

    const lengths = rows.map((row) => (total > 0 ? (row.count / total) * CIRCUMFERENCE : 0));
    const arcs = rows.map((row, i) => ({
        ...row,
        length: Math.max(0, lengths[i] - GAP),
        offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
    }));

    return (
        <Panel title="Stream decision" className="h-full">
            <div className="flex flex-col items-center gap-6 py-3 sm:flex-row sm:justify-around">
                <div className="relative h-[140px] w-[140px] shrink-0">
                    <svg viewBox="0 0 140 140" className="-rotate-90">
                        <circle cx={70} cy={70} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
                        {arcs.map((arc) =>
                            arc.length > 0 ? (
                                <circle
                                    key={arc.bucket}
                                    cx={70}
                                    cy={70}
                                    r={RADIUS}
                                    fill="none"
                                    stroke={arc.color}
                                    strokeWidth={STROKE}
                                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
                                    strokeDashoffset={-arc.offset}
                                />
                            ) : null,
                        )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-semibold text-white">{rows[0].percent}%</span>
                        <span className="text-[11px] text-white/80">Direct Play</span>
                    </div>
                </div>
                <ul className="w-full max-w-[220px] space-y-6">
                    {rows.map((row) => (
                        <li key={row.bucket} className="flex items-center justify-between gap-3 text-[11px] text-white">
                            <span className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                                {row.label}
                            </span>
                            <span>{formatCount(row.count)} ({row.percent}%)</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}
