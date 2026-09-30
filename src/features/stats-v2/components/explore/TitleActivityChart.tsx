"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import type { TitleSeriesRow } from "@/lib/stats/title-detail";
import { EmptyRow, Panel, Tabs, type TabOption } from "../Panel";
import { formatBucketLabel, formatCount, secondsToChartHours } from "../../lib/overview-math";
import { ACCENT, TOOLTIP_STYLE, TRACK } from "../../lib/theme";

type Metric = "plays" | "watch" | "users";

const METRICS: TabOption<Metric>[] = [
    { key: "plays", label: "Plays" },
    { key: "watch", label: "Watch time" },
    { key: "users", label: "Users" },
];

const TOOLTIP_LABEL: Record<Metric, string> = { plays: "Plays", watch: "Hours", users: "Users" };

const METRIC_VALUE: Record<Metric, (row: TitleSeriesRow) => number> = {
    plays: (r) => r.plays,
    watch: (r) => secondsToChartHours(r.seconds),
    users: (r) => r.users,
};

const AXIS = "rgba(255,255,255,0.55)";

/** The title's plays over time — same chart language as the overview's Plays over time. */
export function TitleActivityChart({ series }: { series: TitleSeriesRow[] | undefined }) {
    const [metric, setMetric] = useState<Metric>("plays");
    // Memoized: a fresh array per render restarts Recharts' layout work.
    const points = useMemo(
        () => series?.map((r) => ({ bucket: r.bucket, value: METRIC_VALUE[metric](r) })),
        [series, metric],
    );

    return (
        <Panel title="Plays over time" action={<Tabs options={METRICS} value={metric} onChange={setMetric} size="sm" />} className="flex flex-col">
            <div className="relative min-h-[220px] flex-1">
                {!points ? (
                    <Skeleton className="absolute inset-0 rounded-lg" />
                ) : points.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center"><EmptyRow /></div>
                ) : (
                    <div className="absolute inset-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="v2-title-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={TRACK} vertical={false} />
                                <XAxis dataKey="bucket" tickFormatter={formatBucketLabel} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                                <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={metric === "watch"} />
                                <Tooltip
                                    contentStyle={{ ...TOOLTIP_STYLE, fontSize: 12 }}
                                    labelFormatter={(label) => formatBucketLabel(String(label))}
                                    formatter={(value) => [formatCount(Number(value)), TOOLTIP_LABEL[metric]]}
                                    cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={ACCENT}
                                    strokeWidth={2}
                                    fill="url(#v2-title-fill)"
                                    // Static data; the entry animation can freeze at x=0 on revalidation.
                                    isAnimationActive={false}
                                    activeDot={{ r: 4, stroke: "#000", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </Panel>
    );
}
