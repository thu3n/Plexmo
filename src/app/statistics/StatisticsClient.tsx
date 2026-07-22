"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";
import { StatsPeriodPills } from "@/features/stats/components/StatsPeriodPills";
import { WatchStatsSection } from "@/features/stats/components/overview/WatchStatsSection";
import { TopListsSection } from "@/features/stats/components/TopListsSection";
import { daysForStatsPeriod, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { Skeleton } from "@/components/Skeleton";

// Code-split, not viewport-lazy: the section still mounts immediately, but the
// ~380KB recharts vendor chunk no longer parses on the navigation tap itself —
// interrupting that parse mid-mount was a major rapid-navigation jank source on
// iOS WebKit. After the first visit the chunk is cached and this is invisible.
const ChartsSection = dynamic(
    () => import("@/features/stats/components/ChartsSection").then((m) => m.ChartsSection),
    {
        ssr: false,
        loading: () => (
            <div className="grid gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-72 w-full rounded-3xl" />
                ))}
            </div>
        ),
    },
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StatisticsClient() {
    const [period, setPeriod] = useState<StatsPeriodKey>("30d");
    const [serverId, setServerId] = useState<string | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const days = daysForStatsPeriod(period);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const { data: serversData } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetcher);
    const servers = serversData?.servers ?? [];

    return (
        <div className="relative min-h-dvh">
            <header className="fixed top-0 inset-x-0 z-50 border-b bg-black/80 border-white/5 safe-top">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-white/90">Statistics</h1>
                    <div className="flex items-center gap-4">
                        <HeaderNav />
                        <UserMenu align="top-right" />
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock">
                <div
                    className={clsx(
                        "sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-40 flex flex-wrap items-center gap-2 rounded-3xl transition-all duration-300 p-3 -mx-3 -mt-3 mb-3",
                        scrolled && "bg-slate-950/95 shadow-2xl"
                    )}
                >
                    <StatsPeriodPills period={period} onPeriodChange={setPeriod} />
                    <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/5 bg-white/5 p-1 no-scrollbar">
                        <button
                            onClick={() => setServerId(null)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${serverId === null ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                        >
                            All
                        </button>
                        {servers.map((server) => {
                            const isActive = serverId === server.id;
                            return (
                                <button
                                    key={server.id}
                                    onClick={() => setServerId(isActive ? null : server.id)}
                                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${isActive ? "text-white ring-1 ring-white/20" : "text-white/60 hover:text-white"}`}
                                    style={{ backgroundColor: isActive ? getServerColor(server.id, server.color) : "transparent" }}
                                >
                                    {server.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-10">
                    <WatchStatsSection days={days} serverId={serverId} />
                    <ChartsSection days={days} serverId={serverId} />
                    <TopListsSection days={days} serverId={serverId} />
                </div>
            </main>
        </div>
    );
}
