"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { PauseRow, PauseStats } from "@/lib/stats/viewing-behaviour-pauses";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { InitialBadge, RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { usePauses } from "../../hooks/behaviour";
import { MiniStats, type MiniStat } from "./MiniStats";
import { formatPauseRate } from "./behaviour-format";

type ListKey = "clients" | "titles";

const LISTS: TabOption<ListKey>[] = [
    { key: "clients", label: "Clients" },
    { key: "titles", label: "Titles" },
];

const EMPTY_TEXT: Record<ListKey, string> = {
    clients: "Not enough sessions per client yet",
    titles: "Not enough sessions per title yet",
};

/** Rose = the dashboard's "problem" colour (transcode); marks a likely-buffering client. */
function BufferingBadge() {
    return (
        <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400"
            title="Pauses far more than other clients — possible buffering"
        >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        </span>
    );
}

const toRow = (row: PauseRow): RankedRow => {
    const detail = `${formatCount(row.sessions)} sessions · ${row.pausedSessionShare}% paused`;
    return {
        key: row.key,
        label: row.label,
        sub: [row.flagged ? "Possible buffering" : null, row.sub, detail].filter(Boolean).join(" · "),
        icon: row.flagged ? <BufferingBadge /> : <InitialBadge label={row.label} />,
        values: [row.minutesPerHour.toFixed(1)],
        magnitude: row.minutesPerHour,
    };
};

const headline = (stats: PauseStats | undefined): MiniStat[] | undefined =>
    stats && [
        { label: "Instance avg", value: formatPauseRate(stats.minutesPerHour) },
        { label: "Sessions", value: formatCount(stats.sessions) },
        { label: "Flagged", value: formatCount(stats.clients.filter((c) => c.flagged).length) },
    ];

/**
 * Paused minutes per hour of playback. People pause about the same on any
 * device, so a client far above the instance average points at playback
 * trouble rather than habit.
 */
export function PausePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [list, setList] = useState<ListKey>("clients");
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const stats = usePauses(days, serverId, limit);
    const rows = stats?.[list].map(toRow);

    return (
        <Panel
            id="pauses"
            title="Pause intensity"
            action={<Tabs options={LISTS} value={list} onChange={setList} size="sm" />}
            className="flex flex-col"
        >
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                Paused minutes per hour watched, highest first
            </p>
            <MiniStats stats={headline(stats)} />
            <div className="flex-1">
                <RankedList
                    rows={rows}
                    unit="min/h"
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
