"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { daysForStatsPeriod, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { OverviewHeader } from "../OverviewHeader";
import { EmptyRow, Panel } from "../Panel";
import { formatDateRange } from "../../lib/overview-math";
import { useServers } from "../../hooks/useStatsV2";
import { useTitleDetail } from "../../hooks/explore";
import { LINK_CLASS } from "../../lib/theme";
import { TitleHero } from "./TitleHero";
import { TitleViewersPanel } from "./TitleViewersPanel";
import { TitleQualityPanel, TitleServersPanel } from "./TitleQualityPanels";
import { TitleEpisodesPanel } from "./TitleEpisodesPanel";
import { AlsoWatchedPanel } from "./AlsoWatchedPanel";

// Keep the recharts chunk off the navigation tap, as on the overview.
const TitleActivityChart = dynamic(
    () => import("./TitleActivityChart").then((m) => m.TitleActivityChart),
    { ssr: false, loading: () => <Skeleton className="h-[236px] rounded-xl" /> },
);

const noopSubscribe = () => () => {};
/** Local-time strings differ between the server's TZ and the browser's — render them client-only. */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** /statistics/title/[mediaId] — one title's audience, activity and delivery. */
export function TitleDetailLayout({ mediaId }: { mediaId: number }) {
    const [period, setPeriod] = useState<StatsPeriodKey>("all");
    const [serverId, setServerId] = useState<string | null>(null);
    const [now] = useState(() => Date.now());
    const isClient = useIsClient();
    const days = daysForStatsPeriod(period);
    const servers = useServers();
    const { data, error } = useTitleDetail(mediaId, days, serverId);
    const firstPlayed = data?.summary.firstPlayed ?? undefined;

    return (
        <div className="relative min-h-dvh text-white">
            {/* Same background orbs as the dashboard and the overview (radial gradients, not blur filters). */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)]" />
                <div className="absolute right-[-10%] top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.10),transparent)]" />
                <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.05),transparent)]" />
            </div>

            <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock lg:pb-8">
                <OverviewHeader
                    period={period}
                    onPeriodChange={setPeriod}
                    dateRange={isClient ? formatDateRange(days, now, firstPlayed) : ""}
                    servers={servers}
                    serverId={serverId}
                    onServerChange={setServerId}
                />

                <Link href="/statistics" className={`mb-3 inline-flex items-center gap-1 text-xs font-medium ${LINK_CLASS}`}>
                    <ArrowLeft className="h-3 w-3" />
                    Statistics
                </Link>

                {error && !data ? (
                    <Panel><EmptyRow text="This title is not available" /></Panel>
                ) : (
                    <>
                        <TitleHero detail={data} isClient={isClient} />

                        <div className="mt-4 grid gap-4 xl:grid-cols-12">
                            <div className="min-w-0 xl:col-span-8 [&>section]:h-full">
                                <TitleActivityChart series={data?.series} />
                            </div>
                            <div className="min-w-0 xl:col-span-4 [&>section]:h-full">
                                <TitleQualityPanel decisions={data?.decisions} resolutions={data?.resolutions} />
                            </div>

                            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-12">
                                <TitleViewersPanel viewers={data?.viewers} type={data?.title.type} isClient={isClient} />
                                <TitleServersPanel servers={data?.servers} />
                            </div>

                            {data?.episodes && (
                                <div className="min-w-0 xl:col-span-12">
                                    <TitleEpisodesPanel episodes={data.episodes} />
                                </div>
                            )}

                            <div className="min-w-0 xl:col-span-12">
                                <AlsoWatchedPanel mediaId={mediaId} days={days} serverId={serverId} />
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
