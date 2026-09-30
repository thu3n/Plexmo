"use client";

import { useState } from "react";
import type { BingeRun, BingeShow, BingeStats } from "@/lib/stats/viewing-behaviour-binge";
import { BINGE_GAP_MS, MIN_BINGE_EPISODES } from "@/lib/stats/viewing-behaviour-constants";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { InitialBadge, RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useBinges } from "../../hooks/behaviour";
import { BehaviourPoster } from "./BehaviourPoster";
import { MiniStats, type MiniStat } from "./MiniStats";
import { formatDay, formatSpan, plural } from "./behaviour-format";

type ListKey = "shows" | "longest";

const LISTS: TabOption<ListKey>[] = [
    { key: "shows", label: "Top shows" },
    { key: "longest", label: "Longest" },
];

const GAP_MINUTES = BINGE_GAP_MS / 60_000;

const showRow = (show: BingeShow): RankedRow => ({
    key: show.mediaId,
    label: show.title,
    sub: `${plural(show.users, "viewer")} · longest ${show.longest} in a row`,
    icon: <BehaviourPoster thumb={show.thumb} />,
    values: [formatCount(show.binges), show.avgEpisodes.toFixed(1)],
    magnitude: show.binges,
});

const runRow = (run: BingeRun): RankedRow => ({
    key: `${run.userId}:${run.showId}:${run.startTime}`,
    label: run.showTitle,
    sub: `${run.user} · ${formatDay(run.startTime)} · ${formatSpan(run.startTime, run.stopTime)}`,
    icon: <InitialBadge label={run.user} />,
    values: [formatCount(run.episodes)],
    magnitude: run.episodes,
});

const headline = (stats: BingeStats | undefined): MiniStat[] | undefined =>
    stats && [
        { label: "Binges", value: formatCount(stats.binges) },
        { label: "Avg episodes", value: stats.avgEpisodes.toFixed(1) },
        { label: "Bingers", value: formatCount(stats.bingers) },
    ];

/** Episodes watched back to back: which shows pull people into "one more", and the record runs. */
export function BingePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [list, setList] = useState<ListKey>("shows");
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const stats = useBinges(days, serverId, limit);
    const rows = list === "shows" ? stats?.topShows.map(showRow) : stats?.longest.map(runRow);

    return (
        <Panel
            id="binges"
            title="Binge watching"
            action={<Tabs options={LISTS} value={list} onChange={setList} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                {MIN_BINGE_EPISODES}+ episodes of one show, each starting within {GAP_MINUTES} min of the last
            </p>
            <MiniStats stats={headline(stats)} />
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    columns={list === "shows" ? ["Binges", "Avg eps"] : undefined}
                    unit={list === "longest" ? "episodes" : undefined}
                    skeletonRows={limit}
                    emptyText="No binges this period"
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
