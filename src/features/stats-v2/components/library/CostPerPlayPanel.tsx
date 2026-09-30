"use client";

import { useState } from "react";
import type { CostPerPlayItem } from "@/lib/stats/library-value";
import { DEFAULT_LIST_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useLibraryValue } from "../../hooks/library";
import { formatBytes, titleWithYear } from "./library-format";
import { LibraryPoster } from "./LibraryPoster";

type View = "worst" | "best";

const VIEWS: TabOption<View>[] = [
    { key: "worst", label: "Worst" },
    { key: "best", label: "Best value" },
];

const CAPTIONS: Record<View, string> = {
    worst: "Big files that are rarely watched — size per lifetime play",
    best: "The most watched per gigabyte — size per lifetime play",
};

/**
 * Worst rows' bar = size per play (the cost). Best rows' bar = plays, since a
 * bar that grows as the value shrinks would read backwards.
 */
const toRow = (item: CostPerPlayItem, view: View): RankedRow => ({
    key: `${item.serverId}:${item.ratingKey}`,
    label: titleWithYear(item.title, item.year),
    sub: `${item.fileSize !== null ? formatBytes(item.fileSize) : "—"} · ${formatCount(item.plays)} ${item.plays === 1 ? "play" : "plays"}`,
    icon: <LibraryPoster thumb={item.thumb} />,
    values: [formatBytes(item.bytesPerPlay)],
    magnitude: view === "worst" ? item.bytesPerPlay : item.plays,
});

/** Storage cost per play (movies — shows carry no file size in the inventory). */
export function CostPerPlayPanel({ serverId }: { serverId: string | null }) {
    const [view, setView] = useState<View>("worst");
    const [expanded, setExpanded] = useState(false);
    const items = useLibraryValue(serverId)?.costPerPlay[view];
    const rows = items?.slice(0, expanded ? undefined : DEFAULT_LIST_LIMIT).map((i) => toRow(i, view));

    return (
        <Panel
            id="library-cost-per-play"
            title="Cost per play"
            action={<Tabs options={VIEWS} value={view} onChange={setView} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">{CAPTIONS[view]}</p>
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    unit="per play"
                    skeletonRows={DEFAULT_LIST_LIMIT}
                    emptyText="No played movies with a known file size"
                />
            </div>
            {items && items.length > DEFAULT_LIST_LIMIT && (
                <div className="mt-3 text-right">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
            )}
        </Panel>
    );
}
