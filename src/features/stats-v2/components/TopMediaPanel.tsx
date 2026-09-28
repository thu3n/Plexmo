"use client";

import { useState } from "react";
import clsx from "clsx";
import { SkeletonRows } from "@/components/Skeleton";
import { useTopMediaBoth, type MediaTypeKey, type TopMediaItem, type TopMediaSort } from "@/features/stats/hooks/useOverviewData";
import { buildThumbUrl, POSTER_THUMB_HEIGHT, POSTER_THUMB_WIDTH } from "@/features/stats/lib/top-media-list";
import { EmptyRow, Panel, Tabs, ViewAll, type TabOption } from "./Panel";

const SORTS: TabOption<TopMediaSort>[] = [
    { key: "users", label: "Popular" },
    { key: "plays", label: "Most Watched" },
];

const CONFIG: Record<MediaTypeKey, { title: string; anchor: string; limit: number }> = {
    movie: { title: "Top movies", anchor: "movies", limit: 5 },
    show: { title: "Top shows", anchor: "shows", limit: 10 },
    episode: { title: "Top episodes", anchor: "episodes", limit: 10 },
};

const THUMB_SIZE = { w: POSTER_THUMB_WIDTH, h: POSTER_THUMB_HEIGHT };

function Row({ item, rank, type, sort }: { item: TopMediaItem; rank: number; type: MediaTypeKey; sort: TopMediaSort }) {
    const count = sort === "users" ? item.uniqueUsers : item.plays;
    const countLabel = `${count} ${sort === "users" ? "users" : "plays"}`;
    const src = buildThumbUrl(item.thumb, THUMB_SIZE);
    const isMovie = type === "movie";
    const title = type === "episode" ? (item.showTitle ?? item.title) : item.title;
    const sub =
        type === "episode"
            ? `S${item.seasonNumber ?? "?"}E${item.episodeNumber ?? "?"} · ${item.title}`
            : type === "show"
              ? countLabel
              : item.year ? String(item.year) : "";

    return (
        <li className={clsx("flex items-center gap-3", isMovie ? "py-1.5" : "py-[3px]")}>
            <span className="w-4 shrink-0 text-center text-[11px] text-white/80">{rank}</span>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt=""
                    className={clsx("shrink-0 rounded-sm bg-slate-800 object-cover", isMovie ? "h-[46px] w-[32px]" : "h-[26px] w-[22px]")}
                />
            ) : (
                <div className={clsx("shrink-0 rounded-sm bg-white/5", isMovie ? "h-[46px] w-[32px]" : "h-[26px] w-[22px]")} />
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-white">{title}</p>
                <p className={clsx("truncate text-white/60", isMovie ? "mt-2 text-[10px]" : "text-[8px]")}>{sub}</p>
            </div>
            {type !== "show" && (
                <span className={clsx("shrink-0 text-[9px] text-white/80", isMovie && "self-end")}>{countLabel}</span>
            )}
        </li>
    );
}

export function TopMediaPanel({ type, days, serverId }: { type: MediaTypeKey; days: number; serverId: string | null }) {
    const [sort, setSort] = useState<TopMediaSort>("users");
    const config = CONFIG[type];
    const { data } = useTopMediaBoth(type, days, serverId, config.limit);
    const items = sort === "users" ? data?.byUsers : data?.byPlays;

    return (
        <Panel
            id={config.anchor}
            title={config.title}
            action={<Tabs options={SORTS} value={sort} onChange={setSort} size="sm" />}
            className="flex flex-col"
        >
            {!items ? (
                <SkeletonRows count={config.limit} rowClassName="h-7 rounded" />
            ) : items.length === 0 ? (
                <EmptyRow />
            ) : (
                <ol className="flex-1 space-y-1">
                    {items.map((item, i) => <Row key={item.mediaId} item={item} rank={i + 1} type={type} sort={sort} />)}
                </ol>
            )}
            <div className="mt-2 text-right"><ViewAll href="/libraries" /></div>
        </Panel>
    );
}
