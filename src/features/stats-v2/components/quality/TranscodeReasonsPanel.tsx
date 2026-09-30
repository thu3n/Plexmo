"use client";

import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow, Panel } from "../Panel";
import { formatCount, formatResolutionChange } from "../../lib/overview-math";
import { useTranscodeReasons } from "../../hooks/quality";

/**
 * Why streams transcode: one primary reason per transcode (sums to 100%),
 * each with its most common detail and an actionable hint.
 */
export function TranscodeReasonsPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const data = useTranscodeReasons(days, serverId);

    return (
        <Panel
            id="quality-transcode-reasons"
            title="Transcode reasons"
            action={data && data.transcodes > 0 && (
                <span className="text-xs text-white/55">
                    {formatCount(data.transcodes)} of {formatCount(data.totalPlays)} plays
                </span>
            )}
        >
            {!data ? (
                <SkeletonRows count={4} rowClassName="h-14 rounded-lg" />
            ) : data.reasons.length === 0 ? (
                <EmptyRow text="No transcodes in this period" />
            ) : (
                <ul className="space-y-4">
                    {data.reasons.map((reason) => (
                        <li key={reason.key}>
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="min-w-0 truncate text-[13px] font-medium text-white">
                                    {reason.label}
                                    {reason.topDetail && (
                                        <span className="ml-2 text-[11px] font-normal text-white/55">
                                            {reason.key === "video_resolution" ? formatResolutionChange(reason.topDetail) : reason.topDetail}
                                            {reason.topDetailShare < 100 && ` · ${reason.topDetailShare}%`}
                                        </span>
                                    )}
                                </p>
                                <p className="shrink-0 text-[13px] tabular-nums">
                                    <span className="font-semibold text-white">{reason.share}%</span>
                                    <span className="ml-2 text-white/55">{formatCount(reason.count)}</span>
                                </p>
                            </div>
                            <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06]">
                                <div
                                    className="h-full rounded-full bg-amber-400/80"
                                    style={{ width: `${Math.max(2, reason.share)}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-[11px] leading-snug text-white/55">{reason.hint}</p>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
