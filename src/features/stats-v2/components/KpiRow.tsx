"use client";

import { ArrowDown, ArrowUp, Clock, Play, Shuffle, User, Users, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { formatPeakTimestamp } from "@/features/stats/lib/format";
import { PANEL_CLASS } from "./Panel";
import { Sparkline } from "./Sparkline";
import { formatCount, formatHours, percentOf, trendPercent } from "../lib/overview-math";
import { useActivitySeries, useConcurrentSeries, useDecisionShare, useSummary } from "../hooks/useStatsV2";

type Kpi = {
    label: string;
    value: string;
    icon: LucideIcon;
    iconBg: string;
    trend?: number | null;
    spark?: number[];
    bar?: { percent: number; color: string };
    title?: string;
};

function KpiCard({ kpi, periodLabel }: { kpi: Kpi; periodLabel: string }) {
    const Icon = kpi.icon;
    return (
        <div className={`${PANEL_CLASS} flex items-start gap-3 p-4`} title={kpi.title}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kpi.iconBg}`}>
                <Icon className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white/80">{kpi.label}</p>
                <div className="flex min-w-0 items-end justify-between gap-2">
                    <p className="truncate text-xl font-semibold leading-tight tabular-nums text-white sm:text-2xl">{kpi.value}</p>
                    {/* Two cards per row on phones leave no room for both value and trend line. */}
                    {kpi.spark && kpi.spark.length > 1 && (
                        <span className="hidden sm:block"><Sparkline values={kpi.spark} /></span>
                    )}
                </div>
                {kpi.trend !== undefined && kpi.trend !== null && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/55">
                        <span className={kpi.trend >= 0 ? "flex items-center text-emerald-400" : "flex items-center text-rose-400"}>
                            {kpi.trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(kpi.trend)}%
                        </span>
                        vs. previous {periodLabel}
                    </p>
                )}
                {kpi.bar && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${kpi.bar.percent}%`, backgroundColor: kpi.bar.color }} />
                    </div>
                )}
            </div>
        </div>
    );
}

/** % change vs. the previous window; null when there is nothing to compare against. */
const change = (current: number, previous: number | undefined): number | null =>
    previous === undefined ? null : trendPercent(current, current + previous);

export function KpiRow({ days, serverId, periodLabel }: { days: number; serverId: string | null; periodLabel: string }) {
    const summary = useSummary(days, serverId);
    const series = useActivitySeries(days, serverId);
    const concurrent = useConcurrentSeries(days, serverId);
    const share = useDecisionShare(days, serverId);

    if (!summary) {
        return (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
            </div>
        );
    }

    const prev = summary.previous;
    const shareTotal = share.reduce((sum, r) => sum + r.total, 0);
    const shareOf = (bucket: string) => percentOf(share.find((r) => r.bucket === bucket)?.total ?? 0, shareTotal);
    const peakAt = formatPeakTimestamp(summary.peak.window.timestamp);

    const kpis: Kpi[] = [
        {
            label: "Plays",
            value: formatCount(summary.totalPlays),
            icon: Play,
            iconBg: "bg-[#2f6fec]",
            trend: change(summary.totalPlays, prev?.totalPlays),
            spark: series?.map((r) => r.total),
        },
        {
            label: "Watch time",
            value: formatHours(summary.totalSeconds),
            icon: Clock,
            iconBg: "bg-[#138a5e]",
            trend: change(summary.totalSeconds, prev?.totalSeconds),
            spark: series?.map((r) => r.seconds),
        },
        {
            label: "Users",
            value: formatCount(summary.uniqueUsers),
            icon: User,
            iconBg: "bg-[#3a5bbf]",
            trend: change(summary.uniqueUsers, prev?.uniqueUsers),
            spark: series?.map((r) => r.users),
        },
        {
            label: "Peak concurrent",
            value: formatCount(summary.peak.window.count),
            icon: Users,
            iconBg: "bg-[#3b4a6b]",
            trend: change(summary.peak.window.count, prev?.peak),
            spark: concurrent?.map((r) => r.total),
            title: peakAt ? `Peak reached ${peakAt}` : undefined,
        },
        {
            label: "Direct play",
            value: `${shareOf("direct play")}%`,
            icon: Play,
            iconBg: "bg-[#17b26a]",
            bar: { percent: shareOf("direct play"), color: "#22c55e" },
        },
        {
            label: "Transcode",
            value: `${shareOf("transcode")}%`,
            icon: Shuffle,
            iconBg: "bg-[#7c3aed]",
            bar: { percent: shareOf("transcode"), color: "#8b5cf6" },
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} periodLabel={periodLabel} />)}
        </div>
    );
}
