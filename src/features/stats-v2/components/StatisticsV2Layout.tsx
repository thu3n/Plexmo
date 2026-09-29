"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/Skeleton";
import { STATS_PERIODS, daysForStatsPeriod, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { OverviewHeader } from "./OverviewHeader";
import { KpiRow } from "./KpiRow";
import { StreamDecisionPanel } from "./StreamDecisionPanel";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { TopMediaPanel } from "./TopMediaPanel";
import { StreamQualityPanel, TranscodingDetailsPanel } from "./PlaybackPanels";
import { ClientsPanel, TopUsersPanel } from "./PeoplePanels";
import { TrendingPanel } from "./TrendingPanel";
import { ServersPanel } from "./ServersPanel";
import { formatDateRange } from "../lib/overview-math";
import { useActivitySeries, useServers } from "../hooks/useStatsV2";

// Same reasoning as the v1 page: keep the recharts chunk off the navigation tap.
const PlaysOverTimePanel = dynamic(
    () => import("./PlaysOverTimePanel").then((m) => m.PlaysOverTimePanel),
    { ssr: false, loading: () => <Skeleton className="h-[236px] rounded-xl" /> },
);

const firstBucketTime = (bucket: string | undefined): number | undefined => {
    if (!bucket) return undefined;
    const [y, m, d] = bucket.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
};

const noopSubscribe = () => () => {};
/** Local-time strings differ between the server's TZ and the browser's — render them client-only. */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Statistics v2 prototype — a side-by-side candidate for replacing /statistics. */
export function StatisticsV2Layout() {
    const [period, setPeriod] = useState<StatsPeriodKey>("all");
    const [serverId, setServerId] = useState<string | null>(null);
    const [now] = useState(() => Date.now());
    const isClient = useIsClient();
    const days = daysForStatsPeriod(period);
    const servers = useServers();
    const series = useActivitySeries(days, serverId);
    const scope = { days, serverId };
    const periodLabel = STATS_PERIODS.find((p) => p.key === period)?.label ?? period;

    return (
        <div className="relative min-h-dvh text-white">
            {/* Same background orbs as the dashboard (radial gradients, not blur
                filters — see the iOS note in src/app/page.tsx). */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)]" />
                <div className="absolute right-[-10%] top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.10),transparent)]" />
                <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.05),transparent)]" />
            </div>

            <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock lg:pb-8">
                <div>
                    <OverviewHeader
                        period={period}
                        onPeriodChange={setPeriod}
                        dateRange={isClient ? formatDateRange(days, now, firstBucketTime(series?.[0]?.bucket)) : ""}
                        servers={servers}
                        serverId={serverId}
                        onServerChange={setServerId}
                    />

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
                            <div className="md:col-span-2 [&>section]:h-full"><TranscodingDetailsPanel {...scope} /></div>
                        </div>

                        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-12 xl:grid-cols-3">
                            <TopMediaPanel type="movie" {...scope} />
                            <TopMediaPanel type="show" {...scope} />
                            {/* Replaces Top episodes, which was mostly Top shows again (one
                                series filled half of it) — growth is the list that changes. */}
                            <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full"><TrendingPanel {...scope} /></div>
                        </div>

                        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-12">
                            <TopUsersPanel {...scope} />
                            <ClientsPanel {...scope} />
                        </div>

                        <div className="min-w-0 xl:col-span-12"><ServersPanel {...scope} /></div>
                    </div>
                </div>
            </main>
        </div>
    );
}
