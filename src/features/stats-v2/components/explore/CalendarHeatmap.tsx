"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { Panel } from "../Panel";
import { HEATMAP_RAMP } from "../ActivityHeatmap";
import { HEATMAP_WEEKDAYS, formatCount, levelFor, quantileThresholds } from "../../lib/overview-math";
import { buildCalendarGrid, type CalendarCell } from "../../lib/explore-math";
import { CALENDAR_DAYS, useCalendarSeries } from "../../hooks/explore";

const LEVELS = HEATMAP_RAMP.length - 1;
/** Only every other weekday is labelled, as on GitHub — seven labels crowd 11px rows. */
const LABELLED_ROWS = new Set([0, 2, 4]);
const CELL_PX = 11;
const GAP_PX = 3;
/** Cap so a very wide panel doesn't turn the year into a wall of large tiles. */
const MAX_CELL_PX = 20;
const DAY_LABEL_REM = 2;

const DATE_FMT: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };

const formatDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", DATE_FMT);
};

const describe = (cell: CalendarCell) => `${formatDay(cell.date)} · ${formatCount(cell.value)} plays`;

/**
 * GitHub-style year of plays, one cell per day, in the ActivityHeatmap's amber
 * ramp. Always the last 365 days — the page period would leave it mostly empty.
 */
export function CalendarHeatmap({ serverId }: { serverId: string | null }) {
    const rows = useCalendarSeries(serverId);
    const [hover, setHover] = useState<CalendarCell | null>(null);

    const grid = useMemo(
        () => (rows ? buildCalendarGrid(rows, new Date(), CALENDAR_DAYS) : null),
        [rows],
    );
    const thresholds = useMemo(
        () => (grid ? quantileThresholds(grid.weeks.flat().filter((c) => c.inRange).map((c) => c.value), LEVELS) : []),
        [grid],
    );
    const total = rows?.reduce((sum, r) => sum + r.total, 0) ?? 0;
    // One grid for month labels, weekday labels and cells, with fluid square
    // cells: the year fills a wide panel instead of stopping at ~760px, and
    // the min width keeps cells legible (scrolling sideways) on phones.
    const weeks = grid?.weeks.length ?? 0;
    const gridStyle = {
        gridTemplateColumns: `${DAY_LABEL_REM}rem repeat(${weeks}, minmax(${CELL_PX}px, ${MAX_CELL_PX}px))`,
        gap: GAP_PX,
        minWidth: `calc(${DAY_LABEL_REM}rem + ${weeks * (CELL_PX + GAP_PX)}px)`,
    };

    return (
        <Panel id="calendar" title="Plays per day" action={<span className="text-xs text-white/55">{formatCount(total)} plays in the last year</span>}>
            {!grid ? (
                <Skeleton className="h-[130px] rounded-lg" />
            ) : (
                <div onMouseLeave={() => setHover(null)}>
                    <div className="overflow-x-auto no-scrollbar">
                        <div className="grid text-[10px] text-white/55" style={gridStyle}>
                            {grid.monthLabels.map((label, i) =>
                                label ? (
                                    <span key={`m${i}`} className="whitespace-nowrap pb-1" style={{ gridColumn: i + 2, gridRow: 1 }}>
                                        {label}
                                    </span>
                                ) : null,
                            )}
                            {HEATMAP_WEEKDAYS.map((d, i) =>
                                LABELLED_ROWS.has(i) ? (
                                    <span key={d.key} className="self-center leading-none" style={{ gridColumn: 1, gridRow: i + 2 }}>
                                        {d.label}
                                    </span>
                                ) : null,
                            )}
                            {grid.weeks.map((week, w) =>
                                week.map((cell, d) => {
                                    const place = { gridColumn: w + 2, gridRow: d + 2 };
                                    return cell.inRange ? (
                                        <div
                                            key={cell.date}
                                            onMouseEnter={() => setHover(cell)}
                                            title={describe(cell)}
                                            className="aspect-square rounded-[2px] hover:outline hover:outline-1 hover:outline-white/80"
                                            style={{ ...place, backgroundColor: HEATMAP_RAMP[levelFor(cell.value, thresholds)] }}
                                        />
                                    ) : (
                                        <div key={cell.date} aria-hidden style={place} />
                                    );
                                }),
                            )}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
                        <span className="min-h-[1rem]">{hover ? describe(hover) : "Hover a day for details"}</span>
                        <span className="flex items-center gap-1.5" aria-label="Color scale: less to more">
                            Less
                            {HEATMAP_RAMP.slice(1).map((color) => (
                                <span key={color} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} />
                            ))}
                            More
                        </span>
                    </div>
                </div>
            )}
        </Panel>
    );
}
