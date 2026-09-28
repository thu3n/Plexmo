"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { Panel, Tabs, type TabOption } from "./Panel";
import { formatBucketLabel, formatCount } from "../lib/overview-math";
import { usePlaysSeries } from "../hooks/useStatsV2";

type Metric = "plays" | "watch" | "users" | "concurrent";

// Only plays has a time series today; the other tabs mirror the target design
// and stay disabled until their backend series exist.
const METRICS: TabOption<Metric>[] = [
    { key: "plays", label: "Plays" },
    { key: "watch", label: "Watch time", disabled: true },
    { key: "users", label: "Users", disabled: true },
    { key: "concurrent", label: "Concurrent", disabled: true },
];

const CHART_HEIGHT = 170;
const LINE = "#3b82f6";
const AXIS = "rgba(255,255,255,0.7)";

const compactTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

export function PlaysOverTimePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const series = usePlaysSeries(days, serverId);

    return (
        <Panel title="Plays over time" action={<Tabs options={METRICS} value={metric} onChange={setMetric} />}>
            {!series ? (
                <Skeleton className="h-[170px] rounded-lg" />
            ) : (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <AreaChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: "#0b1222", border: "1px solid #1b2742", borderRadius: 8, fontSize: 12 }}
                            labelFormatter={(label) => formatBucketLabel(String(label))}
                            formatter={(value) => [formatCount(Number(value)), "Plays"]}
                        />
                        <Area type="monotone" dataKey="total" stroke={LINE} strokeWidth={2} fill="url(#v2-plays-fill)" />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </Panel>
    );
}
