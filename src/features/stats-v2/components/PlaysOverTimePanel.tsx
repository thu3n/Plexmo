"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { EmptyRow, Panel, Tabs, type TabOption } from "./Panel";
import { formatBucketLabel, formatCount, secondsToChartHours } from "../lib/overview-math";
import { useActivitySeries, useConcurrentSeries } from "../hooks/useStatsV2";
import { ACCENT, TOOLTIP_STYLE, TRACK } from "../lib/theme";

type Metric = "plays" | "watch" | "users" | "concurrent";

const METRICS: TabOption<Metric>[] = [
    { key: "plays", label: "Plays" },
    { key: "watch", label: "Watch time" },
    { key: "users", label: "Users" },
    { key: "concurrent", label: "Concurrent" },
];

const TOOLTIP_LABEL: Record<Metric, string> = {
    plays: "Plays",
    watch: "Hours",
    users: "Users",
    concurrent: "Peak streams",
};

const AXIS = "rgba(255,255,255,0.55)";

const compactTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export function PlaysOverTimePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const activity = useActivitySeries(days, serverId);
    const concurrent = useConcurrentSeries(days, serverId);

    // Memoized: a fresh array on every render makes Recharts restart its
    // entry animation, so any unrelated re-render froze the area at x=0.
    const points = useMemo(
        () =>
            metric === "concurrent"
                ? concurrent?.map((r) => ({ bucket: r.bucket, value: r.total }))
                : activity?.map((r) => ({
                      bucket: r.bucket,
                      value: metric === "plays" ? r.total : metric === "users" ? r.users : secondsToChartHours(r.seconds),
                  })),
        [metric, activity, concurrent],
    );

    return (
        <Panel
            title="Plays over time"
            action={<Tabs options={METRICS} value={metric} onChange={setMetric} />}
            className="flex flex-col"
        >
            {/* Absolute child: ResponsiveContainer measuring a parent that grows with
                it feeds back and pushes the axis out of the panel. */}
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
                                    <linearGradient id="v2-plays-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={TRACK} vertical={false} />
                                <XAxis
                                    dataKey="bucket"
                                    tickFormatter={formatBucketLabel}
                                    tick={{ fill: AXIS, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={28}
                                />
                                <YAxis
                                    tickFormatter={compactTick}
                                    tick={{ fill: AXIS, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={metric === "watch"}
                                />
                                <Tooltip
                                    contentStyle={{ ...TOOLTIP_STYLE, fontSize: 12 }}
                                    labelFormatter={(label) => formatBucketLabel(String(label))}
                                    formatter={(value) => [formatCount(Number(value)), TOOLTIP_LABEL[metric]]}
                                    cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }}
                                />
                                <Area
                                    type={metric === "concurrent" ? "stepAfter" : "monotone"}
                                    dataKey="value"
                                    stroke={ACCENT}
                                    strokeWidth={2}
                                    fill="url(#v2-plays-fill)"
                                    // Entry animation restarts on every SWR revalidation and can leave
                                    // the area frozen at x=0; the data is static, so skip it.
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
