"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import type { UserStats } from "@/lib/user_stats";
import { avatarSrc } from "@/lib/avatar";
import type { HistoryEntry } from "@/lib/history";
import { HistoryModal } from "@/features/history/components/HistoryModal";
import { UserPeriodChips } from "@/features/users/components/UserPeriodChips";
import { UserStreakBanner } from "@/features/users/components/UserStreakBanner";
import { UserChartsSection } from "@/features/users/components/UserChartsSection";
import { UserUsageCard } from "@/features/users/components/UserUsageCard";
import { UserRecentlyPlayed } from "@/features/users/components/UserRecentlyPlayed";
import { UserRulesTab } from "@/features/users/components/UserRulesTab";
import { Skeleton } from "@/components/Skeleton";
import { UserDetailTabs, panelId, tabId, type UserDetailTab } from "@/features/users/components/UserDetailTabs";
import { DEFAULT_PERIOD, daysForPeriod, type PeriodKey } from "@/features/users/lib/periods";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import { ArrowLeft } from "lucide-react";

export default function UserStatsPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const decodedUsername = decodeURIComponent(username);
    const searchParams = useSearchParams();
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [activeTab, setActiveTab] = useState<UserDetailTab>("stats");
    // The stat chips double as the chart period selector.
    const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
    const days = daysForPeriod(period);

    // Back target: dashboard cards link with ?from=dashboard, statistics with
    // ?from=statistics, rules with ?returnTo=rules; everything else (incl.
    // legacy returnTo=servers) goes to the user directory.
    const returnTo = searchParams.get("returnTo");
    const from = searchParams.get("from");
    const backLink = from === "dashboard"
        ? "/"
        : from === "statistics"
            ? "/statistics/v2"
            : returnTo === "rules"
            ? "/settings/rules"
            : "/settings/users";

    const { data: stats, error, mutate } = useSWR<UserStats>(
        username ? `/api/stats/user?username=${encodeURIComponent(decodedUsername)}` : null,
        fetchJsonOrThrow
    );

    return (
        <div className="text-white">
            {/* Header */}
            <header className="mb-8 flex items-center gap-6">
                <Link
                    href={backLink}
                    aria-label="Back"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                    <ArrowLeft className="h-5 w-5" aria-hidden />
                </Link>
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={avatarSrc(null, decodedUsername)}
                            alt={decodedUsername}
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">{decodedUsername}</h1>
                        <p className="text-white/40">User Statistics</p>
                    </div>
                </div>
            </header>

            <UserDetailTabs active={activeTab} onChange={setActiveTab} />

            <div role="tabpanel" id={panelId(activeTab)} aria-labelledby={tabId(activeTab)}>
                {activeTab === "stats" && error && !stats && (
                    <div role="alert" className="rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                        <p>Error loading stats.</p>
                        {error instanceof Error && error.message && (
                            <p className="mt-1 text-sm text-white/40">{error.message}</p>
                        )}
                        <button
                            type="button"
                            onClick={() => mutate()}
                            className="mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {activeTab === "stats" && !error && !stats && (
                    <div className="space-y-8">
                        <Skeleton className="h-[88px] rounded-2xl" />
                        <Skeleton className="h-28 rounded-2xl" />
                        <Skeleton className="h-[280px] rounded-2xl" />
                    </div>
                )}

                {activeTab === "stats" && stats && (
                    <div className="space-y-8">
                        <UserPeriodChips global={stats.global} selected={period} onSelect={setPeriod} />
                        <UserStreakBanner streaks={stats.streaks} />
                        {stats.accountId && <UserChartsSection accountId={stats.accountId} days={days} />}
                        {/* min-w-0 keeps the horizontally scrolling strips contained
                            inside their grid tracks instead of widening the page. */}
                        <div className="grid gap-6 xl:grid-cols-3">
                            <div className="min-w-0">
                                <UserUsageCard platforms={stats.platforms} players={stats.players} />
                            </div>
                            <div className="min-w-0 xl:col-span-2">
                                <UserRecentlyPlayed entries={stats.recentlyPlayed} onSelect={setSelectedEntry} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "rules" && <UserRulesTab username={decodedUsername} />}
            </div>

            {selectedEntry && (
                <HistoryModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
}
