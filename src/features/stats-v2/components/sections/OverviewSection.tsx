"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/Skeleton";
import { KpiRow } from "../KpiRow";
import { StreamDecisionPanel } from "../StreamDecisionPanel";
import { ActivityHeatmap } from "../ActivityHeatmap";
import { TopMediaPanel } from "../TopMediaPanel";
import { StreamQualityPanel } from "../PlaybackPanels";
import { TrendingPanel } from "../TrendingPanel";
import type { StatsScope } from "./types";

// Same reasoning as the v1 page: keep the recharts chunk off the navigation tap.
const PlaysOverTimePanel = dynamic(
    () => import("../PlaysOverTimePanel").then((m) => m.PlaysOverTimePanel),
    { ssr: false, loading: () => <Skeleton className="h-[236px] rounded-2xl" /> },
);

/** The at-a-glance tab: volume, when, how it's delivered, and what's popular or rising. */
export function OverviewSection({ scope, periodLabel }: { scope: StatsScope; periodLabel: string }) {
    return (
        <>
            <KpiRow {...scope} periodLabel={periodLabel} />

            {/* 12-column grid, full width per row: every list gets enough room for
                its labels, and rows share one height so no column leaves a hole. */}
            <div className="mt-4 grid gap-4 xl:grid-cols-12">
                <div className="flex min-w-0 flex-col gap-4 xl:col-span-8 [&>section:first-child]:flex-1">
                    <PlaysOverTimePanel {...scope} />
                    <ActivityHeatmap {...scope} />
                </div>
                <div className="flex min-w-0 flex-col gap-4 md:grid md:grid-cols-2 xl:col-span-4 xl:flex [&>section]:flex-1">
                    <StreamDecisionPanel {...scope} />
                    <StreamQualityPanel {...scope} />
                </div>

                <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-12 xl:grid-cols-3">
                    <TopMediaPanel type="movie" {...scope} />
                    <TopMediaPanel type="show" {...scope} />
                    {/* Replaces Top episodes, which was mostly Top shows again (one
                        series filled half of it) — growth is the list that changes. */}
                    <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full"><TrendingPanel {...scope} /></div>
                </div>
            </div>
        </>
    );
}
