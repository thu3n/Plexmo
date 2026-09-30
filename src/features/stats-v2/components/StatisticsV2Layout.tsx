"use client";

import { useState, useSyncExternalStore } from "react";
import { STATS_PERIODS, daysForStatsPeriod, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { OverviewHeader } from "./OverviewHeader";
import { SectionTabs, useStatsSection } from "./SectionTabs";
import { OverviewSection } from "./sections/OverviewSection";
import { LibrarySection } from "./sections/LibrarySection";
import { ViewingSection } from "./sections/ViewingSection";
import { PeopleSection } from "./sections/PeopleSection";
import { ServerSection } from "./sections/ServerSection";
import { formatDateRange } from "../lib/overview-math";
import { useActivitySeries, useServers } from "../hooks/useStatsV2";

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
    const [section, setSection] = useStatsSection();
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
                    >
                        <SectionTabs active={section} onSelect={setSection} />
                    </OverviewHeader>

                    <div className="mt-2">
                        {section === "overview" && <OverviewSection scope={scope} periodLabel={periodLabel} />}
                        {section === "library" && <LibrarySection scope={scope} />}
                        {section === "viewing" && <ViewingSection scope={scope} />}
                        {section === "people" && <PeopleSection scope={scope} />}
                        {section === "server" && <ServerSection scope={scope} />}
                    </div>
                </div>
            </main>
        </div>
    );
}
