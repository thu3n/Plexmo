"use client";

import { useState } from "react";
import type { TrendingMediaItem, TrendingMediaType } from "@/lib/stats/trending-media";
import { buildThumbUrl, POSTER_THUMB_HEIGHT, POSTER_THUMB_WIDTH } from "@/features/stats/lib/top-media-list";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "./Panel";
import { RankedList, type RankedRow } from "./RankedList";
import { formatCount } from "../lib/overview-math";
import { trendingDaysFor, useTrending } from "../hooks/useStatsV2";

const TYPES: TabOption<TrendingMediaType>[] = [
    { key: "show", label: "Shows" },
    { key: "movie", label: "Movies" },
];

const THUMB_SIZE = { w: POSTER_THUMB_WIDTH, h: POSTER_THUMB_HEIGHT };

const toRow = (item: TrendingMediaItem): RankedRow => {
    const src = buildThumbUrl(item.thumb, THUMB_SIZE);
    return {
        key: item.mediaId,
        label: item.title,
        sub: `${formatCount(item.plays)} plays · up from ${formatCount(item.previousPlays)}`,
        icon: src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-12 w-8 shrink-0 rounded bg-slate-800 object-cover" />
        ) : (
            <div className="h-12 w-8 shrink-0 rounded bg-white/5" />
        ),
        values: [`+${formatCount(item.delta)}`],
        magnitude: item.delta,
    };
};

/** What people are watching MORE of than last period — the list that changes week to week. */
export function TrendingPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [type, setType] = useState<TrendingMediaType>("show");
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const items = useTrending(type, days, serverId, limit);
    const windowDays = trendingDaysFor(days);

    return (
        <Panel
            id="trending"
            title="Trending"
            action={<Tabs options={TYPES} value={type} onChange={setType} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                Biggest growth in plays, last {windowDays === 1 ? "24h" : `${windowDays} days`} vs the {windowDays === 1 ? "day" : `${windowDays} days`} before
            </p>
            <div className="flex-1">
                <RankedList
                    rows={items?.map(toRow)}
                    unit="plays"
                    skeletonRows={limit}
                    emptyText="Nothing is growing this period"
                    positive
                />
            </div>
            <div className="mt-3 text-right">
                <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
        </Panel>
    );
}
