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
import { DEFAULT_PERIOD, daysForPeriod, type PeriodKey } from "@/features/users/lib/periods";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch stats");
    return response.json();
};

export default function UserStatsPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const decodedUsername = decodeURIComponent(username);
    const searchParams = useSearchParams();
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [activeTab, setActiveTab] = useState<"stats" | "rules">("stats");
    // The stat chips double as the chart period selector.
    const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
    const days = daysForPeriod(period);

    // Back target: dashboard cards link with ?from=dashboard, rules with
    // ?returnTo=rules; everything else (incl. legacy returnTo=servers) goes
    // to the user directory.
    const returnTo = searchParams.get("returnTo");
    const backLink = searchParams.get("from") === "dashboard"
        ? "/"
        : returnTo === "rules"
            ? "/settings/rules"
            : "/settings/users";

    const { data: stats, isLoading, error } = useSWR<UserStats>(
        username ? `/api/stats/user?username=${encodeURIComponent(decodedUsername)}` : null,
        fetchJson
    );

    return (
        <div className="text-white">
            {/* Header */}
            <header className="mb-8 flex items-center gap-6">
                <Link
                    href={backLink}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
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

            {/* Tabs */}
            <div className="flex items-center gap-4 mb-8 border-b border-white/10">
                <button
                    onClick={() => setActiveTab("stats")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "stats" ? "border-amber-500 text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
                >
                    Statistics
                </button>
                <button
                    onClick={() => setActiveTab("rules")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "rules" ? "border-amber-500 text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
                >
                    Rules
                </button>
            </div>

            {activeTab === "stats" && error && (
                <div className="rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                    Error loading stats.
                </div>
            )}

            {activeTab === "stats" && !error && (isLoading || !stats) && (
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

            {selectedEntry && (
                <HistoryModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
}
