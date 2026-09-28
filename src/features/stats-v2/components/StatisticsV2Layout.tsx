"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/Skeleton";
import { STATS_PERIODS, daysForStatsPeriod, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { Sidebar } from "./Sidebar";
import { OverviewHeader } from "./OverviewHeader";
import { KpiRow } from "./KpiRow";
import { StreamDecisionPanel } from "./StreamDecisionPanel";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { TopMediaPanel } from "./TopMediaPanel";
import { StreamQualityPanel, TranscodingDetailsPanel } from "./PlaybackPanels";
import { DevicesPanel, TopPlatformsPanel, TopUsersPanel } from "./PeoplePanels";
import { ServersPanel } from "./ServersPanel";
import { formatDateRange } from "../lib/overview-math";
import { usePlaysSeries, useServers } from "../hooks/useStatsV2";

// Same reasoning as the v1 page: keep the recharts chunk off the navigation tap.
const PlaysOverTimePanel = dynamic(
    () => import("./PlaysOverTimePanel").then((m) => m.PlaysOverTimePanel),
    { ssr: false, loading: () => <Skeleton className="h-[236px] rounded-xl" /> },
);

const UPDATED_FMT: Intl.DateTimeFormatOptions = {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
};

const firstBucketTime = (bucket: string | undefined): number | undefined => {
    if (!bucket) return undefined;
    const [y, m, d] = bucket.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
};

const noopSubscribe = () => () => {};
/** Local-time strings differ between the server's TZ and the browser's — render them client-only. */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const useActiveAnchor = () => {
    const [anchor, setAnchor] = useState("overview");
    useEffect(() => {
        const sync = () => setAnchor(window.location.hash.slice(1) || "overview");
        window.addEventListener("hashchange", sync);
        return () => window.removeEventListener("hashchange", sync);
    }, []);
    return anchor;
};

/** Statistics v2 prototype — a side-by-side candidate for replacing /statistics. */
export function StatisticsV2Layout() {
    const [period, setPeriod] = useState<StatsPeriodKey>("all");
    const [serverId, setServerId] = useState<string | null>(null);
    const [now] = useState(() => Date.now());
    const activeAnchor = useActiveAnchor();
    const isClient = useIsClient();
    const days = daysForStatsPeriod(period);
    const servers = useServers();
    const series = usePlaysSeries(days, serverId);
    const scope = { days, serverId };
    const periodLabel = STATS_PERIODS.find((p) => p.key === period)?.label ?? period;

    return (
        <div className="flex min-h-dvh bg-[#0a1120] text-white">
            <Sidebar active={activeAnchor} updatedAt={isClient ? new Date(now).toLocaleString("en-US", UPDATED_FMT) : ""} />

            <main className="min-w-0 flex-1 px-4 pb-dock sm:px-6 lg:pb-8">
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

                    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="min-w-0 space-y-3">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                                <PlaysOverTimePanel {...scope} />
                                <StreamDecisionPanel {...scope} />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
                                <div className="space-y-3">
                                    <ActivityHeatmap {...scope} />
                                    <StreamQualityPanel {...scope} />
                                </div>
                                <div className="space-y-3">
                                    <TopMediaPanel type="movie" {...scope} />
                                    <TranscodingDetailsPanel {...scope} />
                                </div>
                                <div className="space-y-3">
                                    <TopMediaPanel type="show" {...scope} />
                                    <DevicesPanel {...scope} />
                                </div>
                                <TopMediaPanel type="episode" {...scope} />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 xl:content-start">
                            <ServersPanel {...scope} />
                            <TopUsersPanel {...scope} />
                            <TopPlatformsPanel {...scope} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
