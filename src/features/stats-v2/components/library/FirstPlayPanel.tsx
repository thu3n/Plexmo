"use client";

import { useState } from "react";
import clsx from "clsx";
import type { LibraryMediaType } from "@/lib/stats/library-value-query";
import type { FirstPlayStats } from "@/lib/stats/library-value-timing";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow, Panel, Tabs, type TabOption } from "../Panel";
import { formatCount, formatShare } from "../../lib/overview-math";
import { useLibraryValue } from "../../hooks/library";
import { FIRST_PLAY_BUCKET_LABELS, formatDelay } from "./library-format";

const TYPES: TabOption<LibraryMediaType>[] = [
    { key: "movie", label: "Movies" },
    { key: "show", label: "Shows" },
];

function Distribution({ stats }: { stats: FirstPlayStats }) {
    const max = Math.max(...stats.buckets.map((b) => b.count), 1);
    return (
        <ul className="space-y-2.5">
            {stats.buckets.map((bucket) => (
                <li key={bucket.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-white/80">{FIRST_PLAY_BUCKET_LABELS[bucket.key]}</span>
                        <span className="shrink-0 tabular-nums text-white">
                            {formatCount(bucket.count)}
                            <span className="ml-1.5 text-[11px] text-white/45">{formatShare(bucket.count, stats.total)}</span>
                        </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <div
                            className={clsx("h-full rounded-full", bucket.key === "never" ? "bg-white/25" : "bg-amber-400/80")}
                            style={{ width: `${Math.max(bucket.count > 0 ? 2 : 0, (bucket.count / max) * 100)}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** How long new additions wait before someone first watches them. */
export function FirstPlayPanel({ serverId }: { serverId: string | null }) {
    const [type, setType] = useState<LibraryMediaType>("movie");
    const stats = useLibraryValue(serverId)?.firstPlay[type];

    return (
        <Panel
            id="library-first-play"
            title="Time to first play"
            action={<Tabs options={TYPES} value={type} onChange={setType} size="sm" />}
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">From added to the library to the first real play</p>
            {!stats && <SkeletonRows count={5} rowClassName="h-8 rounded-lg" />}
            {stats && stats.total === 0 && <EmptyRow text="No titles with an added date" />}
            {stats && stats.total > 0 && (
                <>
                    <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <p className="text-2xl font-semibold tabular-nums text-amber-400">
                            {stats.medianMs !== null ? formatDelay(stats.medianMs) : "—"}
                            <span className="ml-1.5 text-xs font-normal text-white/55">median</span>
                        </p>
                        <p className="text-sm text-white/70">
                            {formatShare(stats.played, stats.total)} of {formatCount(stats.total)} ever started
                        </p>
                    </div>
                    <Distribution stats={stats} />
                </>
            )}
        </Panel>
    );
}
