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
import { DevicesPanel, TopPlatformsPanel, TopUsersPanel } from "./PeoplePanels";
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
        <div className="min-h-dvh bg-[#0a1120] text-white">
            <main className="px-4 pb-dock sm:px-6 lg:pb-8">
                <div className="mx-auto max-w-[1600px]">
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
                            <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full"><TopMediaPanel type="episode" {...scope} /></div>
                        </div>

                        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-12 xl:grid-cols-3">
                            <TopUsersPanel {...scope} />
                            <TopPlatformsPanel {...scope} />
                            <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full"><DevicesPanel {...scope} /></div>
                        </div>

                        <div className="min-w-0 xl:col-span-12"><ServersPanel {...scope} /></div>
                    </div>
                </div>
            </main>
        </div>
    );
}
