"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Clock, Play, User, Users, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { formatPeakTimestamp } from "@/features/stats/lib/format";
import { PANEL_CLASS } from "./Panel";
import { Sparkline } from "./Sparkline";
import { formatCount, formatHours, formatWatchTime, trendPercent } from "../lib/overview-math";
import { useActivitySeries, useConcurrentSeries, useSummary } from "../hooks/useStatsV2";

type Kpi = {
    label: string;
    value: string;
    icon: LucideIcon;
    trend?: number | null;
    spark?: number[];
    title?: string;
    /** Drill-down target: a route or an in-page anchor. */
    href?: string;
};

/** Hover affordance only — a linked card must look identical at rest. */
const LINK_CARD_CLASS = "transition-colors hover:bg-white/[0.06] hover:ring-1 hover:ring-amber-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

function KpiCard({ kpi, periodLabel }: { kpi: Kpi; periodLabel: string }) {
    const Icon = kpi.icon;
    const body = (
        <>
            {/* Same icon tile as the dashboard stat cards. */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-amber-400 ring-1 ring-white/10">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{kpi.label}</p>
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
            </div>
        </>
    );
    const className = `${PANEL_CLASS} flex items-start gap-3 p-4`;
    if (kpi.href?.startsWith("#")) {
        // Native anchor: hash-only navigation must fire `hashchange`, which next/link's pushState does not.
        return <a href={kpi.href} className={`${className} ${LINK_CARD_CLASS}`} title={kpi.title}>{body}</a>;
    }
    return kpi.href ? (
        <Link href={kpi.href} className={`${className} ${LINK_CARD_CLASS}`} title={kpi.title}>{body}</Link>
    ) : (
        <div className={className} title={kpi.title}>{body}</div>
    );
}

/** Plays, watch time, users, peak — decision share lives in its own panel, not twice. */
const KPI_COUNT = 4;

/**
 * Drill-down targets. #people is the People section tab (SectionTabs keeps the
 * active section in the hash); #concurrent is handled by PlaysOverTimePanel.
 */
export const KPI_LINKS = {
    plays: "/history",
    users: "#people",
    peak: "#concurrent",
} as const;

/** % change vs. the previous window; null when there is nothing to compare against. */
const change = (current: number, previous: number | undefined): number | null =>
    previous === undefined ? null : trendPercent(current, current + previous);

export function KpiRow({ days, serverId, periodLabel }: { days: number; serverId: string | null; periodLabel: string }) {
    const summary = useSummary(days, serverId);
    const series = useActivitySeries(days, serverId);
    const concurrent = useConcurrentSeries(days, serverId);

    if (!summary) {
        return (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {Array.from({ length: KPI_COUNT }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
            </div>
        );
    }

    const prev = summary.previous;
    const peakAt = formatPeakTimestamp(summary.peak.window.timestamp);

    const kpis: Kpi[] = [
        {
            label: "Plays",
            value: formatCount(summary.totalPlays),
            icon: Play,
            trend: change(summary.totalPlays, prev?.totalPlays),
            spark: series?.map((r) => r.total),
            href: KPI_LINKS.plays,
        },
        {
            label: "Watch time",
            value: formatWatchTime(summary.totalSeconds),
            icon: Clock,
            title: `${formatHours(summary.totalSeconds)} in total`,
            trend: change(summary.totalSeconds, prev?.totalSeconds),
            spark: series?.map((r) => r.seconds),
        },
        {
            label: "Users",
            value: formatCount(summary.uniqueUsers),
            icon: User,
            trend: change(summary.uniqueUsers, prev?.uniqueUsers),
            spark: series?.map((r) => r.users),
            href: KPI_LINKS.users,
        },
        {
            label: "Peak concurrent",
            value: formatCount(summary.peak.window.count),
            icon: Users,
            trend: change(summary.peak.window.count, prev?.peak),
            spark: concurrent?.map((r) => r.total),
            title: peakAt ? `Peak reached ${peakAt}` : undefined,
            href: KPI_LINKS.peak,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} periodLabel={periodLabel} />)}
        </div>
    );
}
