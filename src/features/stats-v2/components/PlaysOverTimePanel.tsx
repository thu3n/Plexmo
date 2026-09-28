"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { EmptyRow, Panel, Tabs, type TabOption } from "./Panel";
import { formatBucketLabel, formatCount, secondsToChartHours } from "../lib/overview-math";
import { useActivitySeries, useConcurrentSeries } from "../hooks/useStatsV2";

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

const CHART_HEIGHT = 170;
const LINE = "#3b82f6";
const AXIS = "rgba(255,255,255,0.7)";

const compactTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export function PlaysOverTimePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const activity = useActivitySeries(days, serverId);
    const concurrent = useConcurrentSeries(days, serverId);

    const points =
        metric === "concurrent"
            ? concurrent?.map((r) => ({ bucket: r.bucket, value: r.total }))
            : activity?.map((r) => ({
                  bucket: r.bucket,
                  value: metric === "plays" ? r.total : metric === "users" ? r.users : secondsToChartHours(r.seconds),
              }));

    return (
        <Panel title="Plays over time" action={<Tabs options={METRICS} value={metric} onChange={setMetric} />}>
            {!points ? (
                <Skeleton className="h-[170px] rounded-lg" />
            ) : points.length === 0 ? (
                <div className="flex h-[170px] items-center justify-center"><EmptyRow /></div>
            ) : (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <AreaChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="v2-plays-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={LINE} stopOpacity={0.55} />
                                <stop offset="100%" stopColor={LINE} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            tickFormatter={formatBucketLabel}
                            tick={{ fill: AXIS, fontSize: 9 }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={24}
                        />
                        <YAxis
                            tickFormatter={compactTick}
                            tick={{ fill: AXIS, fontSize: 9 }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={metric === "watch"}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: "#0b1222", border: "1px solid #1b2742", borderRadius: 8, fontSize: 12 }}
                            labelFormatter={(label) => formatBucketLabel(String(label))}
                            formatter={(value) => [formatCount(Number(value)), TOOLTIP_LABEL[metric]]}
                        />
                        <Area
                            type={metric === "concurrent" ? "stepAfter" : "monotone"}
                            dataKey="value"
                            stroke={LINE}
                            strokeWidth={2}
                            fill="url(#v2-plays-fill)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </Panel>
    );
}
