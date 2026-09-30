"use client";

import { useState } from "react";
import clsx from "clsx";
import { Skeleton } from "@/components/Skeleton";
import { Panel, Tabs, type TabOption } from "./Panel";
import {
    HEATMAP_HOURS,
    HEATMAP_WEEKDAYS,
    buildHeatmapGrid,
    formatCount,
    formatHours,
    levelFor,
    quantileThresholds,
} from "../lib/overview-math";
import { useHeatmapRows, type SeriesRow } from "../hooks/useStatsV2";
import { HeatmapCellSessions } from "./explore/HeatmapCellSessions";

type Metric = "plays" | "watch" | "users";

const METRICS: TabOption<Metric>[] = [
    { key: "plays", label: "Plays" },
    { key: "watch", label: "Watch time" },
    { key: "users", label: "Users" },
];

const METRIC_VALUE: Record<Metric, (row: SeriesRow) => number> = {
    plays: (r) => r.total,
    watch: (r) => r.seconds,
    users: (r) => r.users,
};

const formatCell: Record<Metric, (v: number) => string> = {
    plays: (v) => `${formatCount(v)} plays`,
    watch: (v) => `${formatHours(v)} watched`,
    users: (v) => `${formatCount(v)} users`,
};

/**
 * One-hue sequential amber ramp (the app accent) with monotone lightness so
 * order reads without a legend; index 0 = empty cell, a faint glass tint.
 */
export const HEATMAP_RAMP = ["rgba(255,255,255,0.04)", "#3d2c0b", "#65450c", "#9a650f", "#d18d14", "#f6b72b", "#fde68a"];
const RAMP = HEATMAP_RAMP;
const LEVELS = RAMP.length - 1;
const HOUR_LABEL_EVERY = 3;

type Hover = { day: number; hour: number; value: number } | null;
/** Row index into HEATMAP_WEEKDAYS + hour of the clicked cell. */
type Selected = { day: number; hour: number } | null;

const hourLabel = (hour: number) => String(hour).padStart(2, "0");
const cellLabel = (day: number, hour: number) =>
    `${HEATMAP_WEEKDAYS[day].label} ${hourLabel(hour)}:00–${hourLabel(hour + 1)}:00`;

export function ActivityHeatmap({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const [hover, setHover] = useState<Hover>(null);
    const [selected, setSelected] = useState<Selected>(null);
    const rows = useHeatmapRows(days, serverId);
    const grid = rows
        ? buildHeatmapGrid(rows.map((r) => ({ bucket: r.bucket, total: METRIC_VALUE[metric](r) })))
        : null;
    const thresholds = grid ? quantileThresholds(grid.flat(), LEVELS) : [];

    return (
        <Panel id="activity" title="Activity heatmap" action={<Tabs options={METRICS} value={metric} onChange={setMetric} size="sm" />}>
            {!grid ? (
                <Skeleton className="h-[200px] rounded-lg" />
            ) : (
                <div onMouseLeave={() => setHover(null)}>
                    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 gap-y-[3px]">
                        {grid.map((row, di) => (
                            <div key={HEATMAP_WEEKDAYS[di].key} className="contents">
                                <span className="self-center text-xs text-white/70">{HEATMAP_WEEKDAYS[di].label}</span>
                                <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                                    {row.map((value, hour) => {
                                        const isSelected = selected?.day === di && selected.hour === hour;
                                        return (
                                            <button
                                                type="button"
                                                key={hour}
                                                onMouseEnter={() => setHover({ day: di, hour, value })}
                                                onClick={() => setSelected(isSelected ? null : { day: di, hour })}
                                                aria-pressed={isSelected}
                                                title={`${HEATMAP_WEEKDAYS[di].label} ${hourLabel(hour)}:00 · ${formatCell[metric](value)}`}
                                                className={clsx(
                                                    "h-[22px] cursor-pointer rounded-[3px] transition-[outline] hover:outline hover:outline-2 hover:outline-white/80",
                                                    isSelected && "outline outline-2 outline-amber-300",
                                                )}
                                                style={{ backgroundColor: RAMP[levelFor(value, thresholds)] }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        <span />
                        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] pt-1 text-[11px] text-white/60">
                            {Array.from({ length: HEATMAP_HOURS }, (_, h) => (
                                <span key={h}>{h % HOUR_LABEL_EVERY === 0 ? String(h).padStart(2, "0") : ""}</span>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
                        <span className="min-h-[1rem]">
                            {hover
                                ? `${cellLabel(hover.day, hover.hour)} · ${formatCell[metric](hover.value)}`
                                : "Hover a cell for details, click to list its sessions"}
                        </span>
                        <span className="flex items-center gap-1.5" aria-label="Color scale: less to more">
                            Less
                            {RAMP.slice(1).map((color) => (
                                <span key={color} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} />
                            ))}
                            More
                        </span>
                    </div>

                    {selected && (
                        <HeatmapCellSessions
                            cell={{ weekday: HEATMAP_WEEKDAYS[selected.day].key, hour: selected.hour }}
                            label={cellLabel(selected.day, selected.hour)}
                            days={days}
                            serverId={serverId}
                            onClose={() => setSelected(null)}
                        />
                    )}
                </div>
            )}
        </Panel>
    );
}
