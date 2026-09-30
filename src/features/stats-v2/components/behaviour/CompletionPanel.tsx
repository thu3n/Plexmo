"use client";

import { useState } from "react";
import type { BehaviourMediaType } from "@/lib/stats/viewing-behaviour";
import type { CompletionStats, TitleCompletion } from "@/lib/stats/viewing-behaviour-completion";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useCompletion } from "../../hooks/behaviour";
import { BehaviourPoster } from "./BehaviourPoster";
import { DropOffHistogram } from "./DropOffHistogram";
import { MiniStats, type MiniStat } from "./MiniStats";

type ListKey = "givenUp" | "titles";

const TYPES: TabOption<BehaviourMediaType>[] = [
    { key: "show", label: "Shows" },
    { key: "movie", label: "Movies" },
];

const LISTS: TabOption<ListKey>[] = [
    { key: "givenUp", label: "Given up on" },
    { key: "titles", label: "Most started" },
];

const EMPTY_TEXT: Record<ListKey, string> = {
    givenUp: "No title is being dropped by several people",
    titles: "Not enough started titles this period",
};

const toRow = (list: ListKey) => (item: TitleCompletion): RankedRow => ({
    key: item.mediaId,
    label: item.title,
    sub: item.avgStopPercent === null
        ? `${formatCount(item.users)} viewers · everyone finished`
        : `${formatCount(item.users)} viewers · unfinished stop at ~${item.avgStopPercent}%`,
    icon: <BehaviourPoster thumb={item.thumb} />,
    values: [`${item.completionRate}%`, formatCount(item.attempts)],
    // Give-up list: the bar grows with how badly the title is dropped.
    magnitude: list === "givenUp" ? 100 - item.completionRate : item.attempts,
});

const headline = (stats: CompletionStats | undefined): MiniStat[] | undefined =>
    stats && [
        { label: "Finished", value: `${stats.completionRate}%` },
        { label: "Started", value: formatCount(stats.attempts) },
        { label: "Dropped", value: formatCount(stats.attempts - stats.finished) },
    ];

/** Do people finish what they start? Headline rate, where they stop, and the titles they give up on. */
export function CompletionPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [type, setType] = useState<BehaviourMediaType>("show");
    const [list, setList] = useState<ListKey>("givenUp");
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const stats = useCompletion(type, days, serverId, limit);
    const rows = stats?.[list].map(toRow(list));

    return (
        <Panel
            id="completion"
            title="Completion"
            action={<Tabs options={TYPES} value={type} onChange={setType} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                {type === "show" ? "Each episode a viewer started" : "Each movie a viewer started"}, at the furthest point they reached
            </p>
            <MiniStats stats={headline(stats)} />
            <DropOffHistogram buckets={stats?.histogram} />
            <div className="mb-3 mt-5">
                <Tabs options={LISTS} value={list} onChange={setList} size="sm" />
            </div>
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    columns={["Finished", "Starts"]}
                    skeletonRows={limit}
                    emptyText={EMPTY_TEXT[list]}
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
