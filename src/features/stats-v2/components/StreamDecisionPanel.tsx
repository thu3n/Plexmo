"use client";

import type { ComponentType } from "react";
import { DirectPlayIcon, DirectStreamIcon, TranscodeIcon } from "@/features/dashboard/components/DashboardIcons";
import { Panel } from "./Panel";
import { formatCount, formatShare, percentOf } from "../lib/overview-math";
import { DECISION_COLORS } from "../lib/theme";
import { useDecisionShare } from "../hooks/useStatsV2";

/** Same order, colours and icons as the dashboard Streams card. */
const DECISIONS: { bucket: string; label: string; color: string; icon: ComponentType<{ className?: string }> }[] = [
    { bucket: "direct play", label: "Direct Play", color: DECISION_COLORS.directPlay, icon: DirectPlayIcon },
    { bucket: "direct stream", label: "Direct Stream", color: DECISION_COLORS.directStream, icon: DirectStreamIcon },
    { bucket: "transcode", label: "Transcode", color: DECISION_COLORS.transcode, icon: TranscodeIcon },
];

// A sub-1% share still gets a visible sliver.
const MIN_SEGMENT_PERCENT = 1;

export function StreamDecisionPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const share = useDecisionShare(days, serverId);
    const total = share.reduce((sum, r) => sum + r.total, 0);
    const rows = DECISIONS.map((d) => {
        const count = share.find((r) => r.bucket === d.bucket)?.total ?? 0;
        return { ...d, count, percent: percentOf(count, total) };
    });

    return (
        <Panel title="Stream decision" className="flex flex-col">
            <div className="flex flex-1 flex-col justify-center gap-5">
                <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold leading-none tabular-nums text-white">{formatShare(rows[0].count, total)}</span>
                    <span className="text-xs text-white/50">played without any conversion</span>
                </div>
                <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5">
                    {total > 0 &&
                        rows
                            .filter((row) => row.count > 0)
                            .map((row) => (
                                <div
                                    key={row.bucket}
                                    className="h-full first:rounded-l-full last:rounded-r-full"
                                    style={{ width: `${Math.max((row.count / total) * 100, MIN_SEGMENT_PERCENT)}%`, backgroundColor: row.color }}
                                />
                            ))}
                </div>
                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.bucket} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-[13px] text-white/85">
                                <span style={{ color: row.color }}><row.icon className="h-4 w-4" /></span>
                                {row.label}
                            </span>
                            <span className="flex items-baseline gap-2 tabular-nums">
                                <span className="text-[11px] text-white/45">{formatCount(row.count)}</span>
                                <span className="w-10 text-right text-[13px] font-semibold text-white">{formatShare(row.count, total)}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}
