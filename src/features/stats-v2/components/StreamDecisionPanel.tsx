"use client";

import { Panel } from "./Panel";
import { formatCount, formatShare, percentOf } from "../lib/overview-math";
import { useDecisionShare } from "../hooks/useStatsV2";

const DECISIONS = [
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
        <Panel title="Stream decision" className="flex flex-col">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-2 sm:flex-row sm:justify-around">
                <div className="relative h-[150px] w-[150px] shrink-0">
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
                        <span className="text-[28px] font-semibold leading-none text-white">{rows[0].percent}%</span>
                        <span className="mt-1 text-xs text-white/70">Direct Play</span>
                    </div>
                </div>
                <ul className="w-full max-w-[260px] space-y-4">
                    {rows.map((row) => (
                        <li key={row.bucket} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2.5 text-[13px] text-white">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                                {row.label}
                            </span>
                            <span className="text-right tabular-nums">
                                <span className="block text-[13px] font-semibold text-white">{formatShare(row.count, total)}</span>
                                <span className="block text-[11px] text-white/55">{formatCount(row.count)}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}
