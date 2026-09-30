"use client";

import { useState } from "react";
import { useTopMediaBoth, type MediaTypeKey, type TopMediaItem, type TopMediaSort } from "@/features/stats/hooks/useOverviewData";
import { buildThumbUrl, POSTER_THUMB_HEIGHT, POSTER_THUMB_WIDTH } from "@/features/stats/lib/top-media-list";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "./Panel";
import { RankedList, type RankedRow } from "./RankedList";
import { formatCount } from "../lib/overview-math";
import { titleHref } from "../lib/explore-math";

const SORTS: TabOption<TopMediaSort>[] = [
    { key: "users", label: "Popular" },
    { key: "plays", label: "Most Watched" },
];

const CONFIG: Record<MediaTypeKey, { title: string; anchor: string }> = {
    movie: { title: "Top movies", anchor: "movies" },
    show: { title: "Top shows", anchor: "shows" },
    episode: { title: "Top episodes", anchor: "episodes" },
};

const THUMB_SIZE = { w: POSTER_THUMB_WIDTH, h: POSTER_THUMB_HEIGHT };

function Poster({ item }: { item: TopMediaItem }) {
    const src = buildThumbUrl(item.thumb, THUMB_SIZE);
    // NEVER loading="lazy" — the same rule as v1's list thumbs (hidden variants must preload).
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-12 w-8 shrink-0 rounded bg-slate-800 object-cover" />
    ) : (
        <div className="h-12 w-8 shrink-0 rounded bg-white/5" />
    );
}

/** The sub line carries the OTHER metric, so both are visible without toggling. */
const toRow = (item: TopMediaItem, type: MediaTypeKey, sort: TopMediaSort): RankedRow => {
    const value = sort === "users" ? item.uniqueUsers : item.plays;
    const other = sort === "users" ? `${formatCount(item.plays)} plays` : `${formatCount(item.uniqueUsers)} users`;
    const lead =
        type === "episode"
            ? `S${item.seasonNumber ?? "?"}E${item.episodeNumber ?? "?"} · ${item.title}`
            : type === "movie" && item.year
              ? String(item.year)
              : null;
    return {
        key: item.mediaId,
        label: type === "episode" ? (item.showTitle ?? item.title) : item.title,
        href: titleHref(item.mediaId),
        sub: lead ? `${lead} · ${other}` : other,
        icon: <Poster item={item} />,
        values: [formatCount(value)],
        magnitude: value,
    };
};

export function TopMediaPanel({ type, days, serverId }: { type: MediaTypeKey; days: number; serverId: string | null }) {
    const [sort, setSort] = useState<TopMediaSort>("users");
    const [expanded, setExpanded] = useState(false);
    const config = CONFIG[type];
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const { data } = useTopMediaBoth(type, days, serverId, limit);
    const items = sort === "users" ? data?.byUsers : data?.byPlays;

    return (
        <Panel
            id={config.anchor}
            title={config.title}
            action={<Tabs options={SORTS} value={sort} onChange={setSort} size="sm" />}
            className="flex flex-col"
        >
            <div className="flex-1">
                <RankedList
                    rows={items?.map((item) => toRow(item, type, sort))}
                    unit={sort === "users" ? "users" : "plays"}
                    skeletonRows={limit}
                />
            </div>
            <div className="mt-3 text-right">
                <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
        </Panel>
    );
}
