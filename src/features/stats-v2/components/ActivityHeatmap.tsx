"use client";

import { useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { Panel, Tabs, type TabOption } from "./Panel";
import { HEATMAP_WEEKDAYS, buildHeatmapGrid, formatHours } from "../lib/overview-math";
import { useHeatmapRows, type SeriesRow } from "../hooks/useStatsV2";

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
    plays: (v) => `${v} plays`,
    watch: (v) => formatHours(v),
    users: (v) => `${v} users`,
};

const HOUR_TICKS = ["00", "04", "08", "12", "16", "20", "24"];

/** Navy → bright blue ramp, one hue, intensity by share of the busiest cell. */
const cellColor = (value: number, max: number) => {
    if (max === 0 || value === 0) return "rgba(59,130,246,0.08)";
    const t = value / max;
    return `rgba(59,130,246,${(0.15 + t * 0.85).toFixed(2)})`;
};

export function ActivityHeatmap({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const rows = useHeatmapRows(days, serverId);
    const grid = rows
        ? buildHeatmapGrid(rows.map((r) => ({ bucket: r.bucket, total: METRIC_VALUE[metric](r) })))
        : null;
    const max = grid ? Math.max(...grid.flat()) : 0;

    return (
        <Panel id="activity" title="Activity heatmap" action={<Tabs options={METRICS} value={metric} onChange={setMetric} size="sm" />}>
            {!grid ? (
                <Skeleton className="h-[180px] rounded-lg" />
            ) : (
                <div className="flex gap-2">
                    <div className="flex flex-col justify-around pb-5 text-[9px] text-white/80">
                        {HEATMAP_WEEKDAYS.map((d) => <span key={d.key}>{d.label}</span>)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                            {grid.map((row, ri) =>
                                row.map((value, hour) => (
                                    <div
                                        key={`${ri}-${hour}`}
                                        title={`${HEATMAP_WEEKDAYS[ri].label} ${String(hour).padStart(2, "0")}:00 · ${formatCell[metric](value)}`}
                                        className="aspect-square rounded-[1px]"
                                        style={{ backgroundColor: cellColor(value, max) }}
                                    />
                                )),
                            )}
                        </div>
                        <div className="mt-2 flex justify-between text-[9px] text-white/80">
                            {HOUR_TICKS.map((h) => <span key={h}>{h}</span>)}
                        </div>
                    </div>
                </div>
            )}
        </Panel>
    );
}
