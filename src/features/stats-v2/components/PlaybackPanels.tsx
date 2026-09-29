"use client";

import { AudioLines, Film, Maximize } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow, Panel, ViewAll } from "./Panel";
import { formatCount, formatResolutionChange, formatShare, groupResolutions, percentOf } from "../lib/overview-math";
import { useResolutionShare, useTranscodeDetails, type TranscodeDetailRow } from "../hooks/useStatsV2";

type Scope = { days: number; serverId: string | null };

/** One-hue ramp, brightest = highest resolution — order carries meaning, not identity. */
// Tailwind amber-200 / 400 / 600 / 700.
const RESOLUTION_COLORS: Record<string, string> = { "4K": "#fde68a", "1080p": "#fbbf24", "720p": "#d97706", SD: "#b45309" };

export function StreamQualityPanel({ days, serverId }: Scope) {
    const rows = useResolutionShare(days, serverId);
    const known = groupResolutions(rows ?? []);
    const total = known.reduce((sum, r) => sum + r.total, 0);

    return (
        <Panel id="stream-quality" title="Delivered quality" action={<ViewAll href="/history" label="View history" />}>
            {!rows ? (
                <SkeletonRows count={4} rowClassName="h-10 rounded" />
            ) : known.length === 0 ? (
                <EmptyRow />
            ) : (
                <div className="space-y-4">
                    {known.map((row) => {
                        const percent = percentOf(row.total, total);
                        return (
                            <div key={row.label}>
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="flex items-baseline gap-2">
                                        <span className="text-lg font-semibold tabular-nums text-white">{formatShare(row.total, total)}</span>
                                        <span className="text-[13px] text-white/75">{row.label}</span>
                                    </span>
                                    <span className="text-xs tabular-nums text-white/55">{formatCount(row.total)} streams</span>
                                </div>
                                <div className="mt-1.5 h-2 rounded-full bg-white/[0.06]">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${Math.max(percent, 1)}%`,
                                            backgroundColor: RESOLUTION_COLORS[row.label],
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

const DETAIL_META: Record<TranscodeDetailRow["bucket"], { label: string; icon: typeof Film }> = {
    video: { label: "Video transcodes", icon: Film },
    audio: { label: "Audio transcodes", icon: AudioLines },
    resolution: { label: "Resolution changes", icon: Maximize },
};

const describe = (row: TranscodeDetailRow): string => {
    if (!row.detail) return "No dominant change";
    const detail = row.bucket === "resolution" ? formatResolutionChange(row.detail) : row.detail;
    return `Most common: ${detail}`;
};

export function TranscodingDetailsPanel({ days, serverId }: Scope) {
    const rows = useTranscodeDetails(days, serverId);
    return (
        <Panel id="transcoding" title="Transcoding details" action={<ViewAll href="/history" label="View history" />}>
            {!rows ? (
                <SkeletonRows count={3} rowClassName="h-12 rounded" />
            ) : (
                <ul className="divide-y divide-white/5">
                    {rows.map((row) => {
                        const meta = DETAIL_META[row.bucket];
                        return (
                            <li key={row.bucket} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-400/10">
                                        <meta.icon className="h-4 w-4 text-rose-400" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-white">{meta.label}</p>
                                        <p className="truncate text-xs text-white/60">{describe(row)}</p>
                                    </div>
                                </div>
                                <span className="text-base font-semibold tabular-nums text-white">{formatCount(row.total)}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
