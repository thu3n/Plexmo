"use client";

import { useState } from "react";
import type { LibraryValueItem } from "@/lib/stats/library-value";
import type { LibraryMediaType } from "@/lib/stats/library-value-query";
import { DEFAULT_LIST_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { DEFAULT_STALE_MONTHS, STALE_MONTH_OPTIONS, useLibraryValue, type StaleMonths } from "../../hooks/library";
import { formatBytes, formatDelay, formatMonthYear, lastPlayedLabel, titleWithYear } from "./library-format";
import { LibraryPoster } from "./LibraryPoster";

const TYPES: TabOption<LibraryMediaType>[] = [
    { key: "movie", label: "Movies" },
    { key: "show", label: "Shows" },
];

const MONTH_TABS: TabOption<`${StaleMonths}`>[] = STALE_MONTH_OPTIONS.map((m) => ({ key: `${m}`, label: `${m}mo` }));

const subFor = (item: LibraryValueItem, now: number, multiServer: boolean) => {
    const parts = [lastPlayedLabel(item.lastPlayed, now)];
    if (item.addedAt) parts.push(`added ${formatMonthYear(item.addedAt)}`);
    if (multiServer && item.serverName) parts.push(item.serverName);
    return parts.join(" · ");
};

/**
 * Movies rank by file size (the disk you get back). Shows have no size in the
 * inventory, so they rank oldest-added first and show how long they've idled.
 */
const toRow = (item: LibraryValueItem, now: number, multiServer: boolean): RankedRow => {
    const idleMs = now - (item.lastPlayed ?? item.addedAt ?? now);
    return {
        key: `${item.serverId}:${item.ratingKey}`,
        label: titleWithYear(item.title, item.year),
        sub: subFor(item, now, multiServer),
        icon: <LibraryPoster thumb={item.thumb} />,
        values: [item.fileSize !== null ? formatBytes(item.fileSize) : formatDelay(idleMs)],
        magnitude: item.fileSize ?? idleMs,
    };
};

/** Titles nobody watches, biggest first — what a library clean-up would reclaim. */
export function DeadWeightPanel({ serverId }: { serverId: string | null }) {
    const [type, setType] = useState<LibraryMediaType>("movie");
    const [months, setMonths] = useState<`${StaleMonths}`>(`${DEFAULT_STALE_MONTHS}`);
    const [expanded, setExpanded] = useState(false);
    const data = useLibraryValue(serverId, Number(months));
    const result = data?.deadWeight[type];
    const now = data?.generatedAt ?? 0;
    const multiServer = !serverId && new Set(result?.items.map((i) => i.serverId)).size > 1;
    const rows = result?.items.slice(0, expanded ? undefined : DEFAULT_LIST_LIMIT).map((i) => toRow(i, now, multiServer));

    return (
        <Panel
            id="library-dead-weight"
            title="Dead weight"
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <Tabs options={MONTH_TABS} value={months} onChange={setMonths} size="sm" />
                    <Tabs options={TYPES} value={type} onChange={setType} size="sm" />
                </div>
            }
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                Not played in {months} months (or never), added before then
            </p>
            {result && result.count > 0 && (
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    {result.reclaimableBytes > 0 && (
                        <p className="text-2xl font-semibold tabular-nums text-amber-400">
                            {formatBytes(result.reclaimableBytes)}
                            <span className="ml-1.5 text-xs font-normal text-white/55">reclaimable</span>
                        </p>
                    )}
                    <p className="text-sm text-white/70">
                        {formatCount(result.count)} {result.count === 1 ? "title" : "titles"}
                        {result.unknownSizeCount > 0 && type === "movie" && (
                            <span className="text-white/45"> · {formatCount(result.unknownSizeCount)} without size</span>
                        )}
                    </p>
                </div>
            )}
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    unit={type === "movie" ? "size" : "idle"}
                    skeletonRows={DEFAULT_LIST_LIMIT}
                    emptyText="Everything here has been played recently"
                />
            </div>
            {result && result.items.length > DEFAULT_LIST_LIMIT && (
                <div className="mt-3 text-right">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
            )}
        </Panel>
    );
}
