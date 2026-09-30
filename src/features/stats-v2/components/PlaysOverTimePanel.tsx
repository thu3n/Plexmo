"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { EmptyRow, Panel, Tabs, type TabOption } from "./Panel";
import { formatBucketLabel, formatCount, secondsToChartHours } from "../lib/overview-math";
import { useActivitySeries, useConcurrentSeries } from "../hooks/useStatsV2";
import { ACCENT, TOOLTIP_STYLE, TRACK } from "../lib/theme";
import { compareOffsetDays, mergeCompareSeries } from "../lib/explore-math";
import { usePreviousSeries } from "../hooks/explore";
import { ALL_TIME_DAYS } from "@/features/stats/lib/stats-periods";

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

/** In-page hash (KpiRow's Peak card) that opens this panel on the Concurrent tab. */
export const CONCURRENT_HASH = "#concurrent";
const PREVIOUS_KEY = "previous";

type Point = { bucket: string; value: number };

const toPoints = (
    metric: Metric,
    activity: { bucket: string; total: number; users: number; seconds: number }[] | undefined,
    concurrent: { bucket: string; total: number }[] | undefined,
): Point[] | undefined =>
    metric === "concurrent"
        ? concurrent?.map((r) => ({ bucket: r.bucket, value: r.total }))
        : activity?.map((r) => ({
              bucket: r.bucket,
              value: metric === "plays" ? r.total : metric === "users" ? r.users : secondsToChartHours(r.seconds),
          }));

/** Opens the Concurrent tab when the page's hash asks for it, then clears the hash so a repeat click works. */
function useConcurrentHash(onMatch: () => void) {
    const onMatchRef = useRef(onMatch);
    useEffect(() => {
        onMatchRef.current = onMatch;
    });
    useEffect(() => {
        const check = () => {
            if (window.location.hash !== CONCURRENT_HASH) return;
            onMatchRef.current();
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        };
        check();
        window.addEventListener("hashchange", check);
        return () => window.removeEventListener("hashchange", check);
    }, []);
}

function CompareToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={on}
            title="Overlay the previous period (dashed)"
            className={clsx(
                "whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                on ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-white/5 bg-white/5 text-white/60 hover:text-white",
            )}
        >
            Compare
        </button>
    );
}

export function PlaysOverTimePanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [metric, setMetric] = useState<Metric>("plays");
    const [compare, setCompare] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const activity = useActivitySeries(days, serverId);
    const concurrent = useConcurrentSeries(days, serverId);
    const offsetDays = compareOffsetDays(days, ALL_TIME_DAYS);
    const comparing = compare && offsetDays !== null;
    const previous = usePreviousSeries(days, serverId, comparing ? offsetDays : null);

    useConcurrentHash(() => {
        setMetric("concurrent");
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Memoized: a fresh array on every render makes Recharts restart its
    // entry animation, so any unrelated re-render froze the area at x=0.
    const points = useMemo(() => {
        const current = toPoints(metric, activity, concurrent);
        if (!current || !comparing || offsetDays === null) return current;
        const prior = toPoints(metric, previous.activity, previous.concurrent);
        return prior ? mergeCompareSeries(current, prior, offsetDays) : current;
    }, [metric, activity, concurrent, comparing, offsetDays, previous.activity, previous.concurrent]);

    return (
        <Panel
            id="plays-over-time"
            title="Plays over time"
            action={
                <div className="flex flex-wrap items-center gap-2">
                    {offsetDays !== null && <CompareToggle on={compare} onToggle={() => setCompare((c) => !c)} />}
                    <Tabs options={METRICS} value={metric} onChange={setMetric} />
                </div>
            }
            className="flex flex-col"
        >
            {/* Absolute child: ResponsiveContainer measuring a parent that grows with
                it feeds back and pushes the axis out of the panel. */}
            <div ref={panelRef} className="relative min-h-[220px] flex-1">
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
                                    formatter={(value, name) => [
                                        formatCount(Number(value)),
                                        name === PREVIOUS_KEY ? `${TOOLTIP_LABEL[metric]} (previous)` : TOOLTIP_LABEL[metric],
                                    ]}
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
                                {comparing && (
                                    <Area
                                        type={metric === "concurrent" ? "stepAfter" : "monotone"}
                                        dataKey={PREVIOUS_KEY}
                                        name={PREVIOUS_KEY}
                                        stroke={ACCENT}
                                        strokeOpacity={0.55}
                                        strokeWidth={1.5}
                                        strokeDasharray="4 4"
                                        fill="none"
                                        isAnimationActive={false}
                                        activeDot={false}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </Panel>
    );
}
