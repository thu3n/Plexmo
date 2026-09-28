"use client";

import { AudioLines, Film, Maximize } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import { Panel, ViewAll } from "./Panel";
import { DECISIONS } from "./StreamDecisionPanel";
import { formatCount, percentOf } from "../lib/overview-math";
import { useDecisionShare, useTranscodeDetails, type TranscodeDetailRow } from "../hooks/useStatsV2";

type Scope = { days: number; serverId: string | null };

// Screenshot order: direct play, transcode, direct stream.
const QUALITY_ORDER = ["direct play", "transcode", "direct stream"] as const;

export function StreamQualityPanel({ days, serverId }: Scope) {
    const share = useDecisionShare(days, serverId);
    const total = share.reduce((sum, r) => sum + r.total, 0);

    return (
        <Panel
            id="stream-quality"
            title="Stream quality"
            action={
                <span className="rounded-md border border-[#1b2742] px-2 py-1">
                    <ViewAll href="/history" label="View details" />
                </span>
            }
        >
            <div className="space-y-5 pt-1">
                {QUALITY_ORDER.map((bucket) => {
                    const decision = DECISIONS.find((d) => d.bucket === bucket)!;
                    const percent = percentOf(share.find((r) => r.bucket === bucket)?.total ?? 0, total);
                    return (
                        <div key={bucket}>
                            <p className="flex items-baseline gap-3">
                                <span className="text-xl font-semibold text-white">{percent}%</span>
                                <span className="text-[10px] text-white/80">{decision.label}</span>
                            </p>
                            <div className="mt-2 h-2 w-full rounded-full bg-[#1b2742]">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: decision.color }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-6 text-right"><ViewAll href="/history" label="View details" /></div>
        </Panel>
    );
}

const DETAIL_META: Record<TranscodeDetailRow["bucket"], { label: string; icon: typeof Film }> = {
    video: { label: "Video", icon: Film },
    audio: { label: "Audio", icon: AudioLines },
    resolution: { label: "Resolution", icon: Maximize },
};

export function TranscodingDetailsPanel({ days, serverId }: Scope) {
    const rows = useTranscodeDetails(days, serverId);
    return (
        <Panel id="transcoding" title="Transcoding details">
            {!rows ? (
                <SkeletonRows count={3} rowClassName="h-8 rounded" />
            ) : (
                <ul className="space-y-3">
                    {rows.map((row) => {
                        const meta = DETAIL_META[row.bucket];
                        return (
                            <li key={row.bucket} className="flex items-start justify-between gap-3">
                                <div className="flex gap-2">
                                    <meta.icon className="mt-0.5 h-3.5 w-3.5 text-[#5b8cff]" />
                                    <div>
                                        <p className="text-[11px] text-white">{meta.label}</p>
                                        <p className="text-[10px] text-white/70">{row.detail ?? "Transcoded streams"}</p>
                                    </div>
                                </div>
                                <span className="text-[11px] tabular-nums text-white">{formatCount(row.total)}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="mt-3 text-right"><ViewAll href="/history" /></div>
        </Panel>
    );
}
