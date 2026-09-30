"use client";

import { useState } from "react";
import type { AbandonedSeries, AbandonedShow } from "@/lib/stats/viewing-behaviour-abandoned";
import { ABANDON_AFTER_DAYS } from "@/lib/stats/viewing-behaviour-constants";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { InitialBadge, RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useAbandoned } from "../../hooks/behaviour";
import { BehaviourPoster } from "./BehaviourPoster";
import { episodeCode, formatDay, plural } from "./behaviour-format";

type ListKey = "recent" | "shows";

const LISTS: TabOption<ListKey>[] = [
    { key: "recent", label: "Recent" },
    { key: "shows", label: "By show" },
];

const itemRow = (item: AbandonedSeries): RankedRow => {
    const position = episodeCode(item.seasonNumber, item.episodeNumber);
    const partial = item.lastPercent !== null && item.lastPercent < 100 ? ` at ${item.lastPercent}%` : "";
    return {
        key: `${item.userId}:${item.showId}`,
        label: item.showTitle,
        sub: [item.user, position && `stopped ${position}${partial}`, formatDay(item.lastWatchedAt)]
            .filter(Boolean)
            .join(" · "),
        icon: <InitialBadge label={item.user} />,
        values: [formatCount(item.episodesWatched)],
        magnitude: item.episodesWatched,
    };
};

const showRow = (show: AbandonedShow): RankedRow => ({
    key: show.mediaId,
    label: show.title,
    icon: <BehaviourPoster thumb={show.thumb} />,
    values: [formatCount(show.users)],
    magnitude: show.users,
});

/** Series people started, stopped mid-season, and never came back to. */
export function AbandonedPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [list, setList] = useState<ListKey>("recent");
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const stats = useAbandoned(days, serverId, limit);
    const rows = list === "recent" ? stats?.items.map(itemRow) : stats?.shows.map(showRow);

    return (
        <Panel
            id="abandoned"
            title="Abandoned series"
            action={<Tabs options={LISTS} value={list} onChange={setList} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                Stopped mid-season, untouched for {ABANDON_AFTER_DAYS}+ days
                {stats && stats.total > 0 ? ` · ${plural(stats.total, "series", "series")} in this period` : ""}
            </p>
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    unit={list === "recent" ? "episodes" : "viewers"}
                    skeletonRows={limit}
                    emptyText="Nobody dropped a series this period"
                />
            </div>
            {(expanded || (rows?.length ?? 0) >= DEFAULT_LIST_LIMIT) && (
                <div className="mt-3 text-right">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
            )}
        </Panel>
    );
}
