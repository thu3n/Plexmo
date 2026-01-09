"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Activity, Tv, X, ArrowLeft, Users, Play, Clock, User, Flame } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { UserMenu } from "@/components/UserMenu";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";


const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Snapshot = {
    count: number;
    timestamp: number;
    sessions: any[];
};

const SkeletonCard = () => (
    <div className="bg-gray-800/50 rounded-xl p-4 flex gap-4 min-w-[300px] border border-gray-700/50 shrink-0 animate-pulse">
        <div className="w-16 h-24 bg-gray-700 rounded-lg shrink-0" />
        <div className="flex flex-col justify-center flex-1 gap-2">
            <div className="h-5 bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-700 rounded w-1/2" />
        </div>
    </div>
);

export default function StatisticsPage() {
    const { t } = useLanguage();
    const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [popularRange, setPopularRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
    const [activePlaysCardIndex, setActivePlaysCardIndex] = useState(0);
    const [activePlayTimeIndex, setActivePlayTimeIndex] = useState(0);

    const router = useRouter();

    const { data: snapshot } = useSWR<Snapshot>(
        `/api/statistics/concurrent?range=${range}`,
        fetcher
    );

    const { data: summaryStats } = useSWR<{ totalPlays: number, uniqueUsers: number, totalDurationHours: number, topUsers: any[] }>(
        `/api/statistics/summary?range=${range}`,
        fetcher
    );

    const { data: streaksData } = useSWR<{ topStreaks: any[] }>(
        `/api/statistics/streaks`,
        fetcher,
        {
            revalidateOnFocus: false, // Don't revalidate on focus to save resources
            dedupingInterval: 60000 // Cache for 1 minute
        }
    );

    const [activeTab, setActiveTab] = useState<'movies' | 'episodes' | 'shows'>('movies');

    // Most Watched Content State
    const [mostWatchedRange, setMostWatchedRange] = useState<"24h" | "7d" | "30d" | "all">("24h");
    const [activeMostWatchedTab, setActiveMostWatchedTab] = useState<'movies' | 'episodes' | 'shows'>('movies');

    // Popular Content Data (Unique Users)
    const { data: popularMovies } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${popularRange}&type=movie`,
        fetcher
    );

    const { data: popularEpisodes } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${popularRange}&type=episode`,
        fetcher
    );

    const { data: popularSeries } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${popularRange}&type=show`,
        fetcher
    );

    // Most Watched Content Data (Total Plays)
    const { data: mostWatchedMovies } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${mostWatchedRange}&type=movie&sort=total_plays`,
        fetcher
    );

    const { data: mostWatchedEpisodes } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${mostWatchedRange}&type=episode&sort=total_plays`,
        fetcher
    );

    const { data: mostWatchedSeries } = useSWR<{ data: any[] }>(
        `/api/statistics/popular?range=${mostWatchedRange}&type=show&sort=total_plays`,
        fetcher
    );

    const [selectedItem, setSelectedItem] = useState<{ ratingKey: string; serverId: string; title: string, thumb?: string, type?: string, source?: 'popular' | 'most_watched' } | null>(null);
    const [selectedStreakUser, setSelectedStreakUser] = useState<{ username: string; userId?: string } | null>(null);

    const { data: streakDetails } = useSWR<{ username: string; streakCount: number; history: any[] }>(
        selectedStreakUser
            ? `/api/statistics/streak-details?username=${encodeURIComponent(selectedStreakUser.username)}&userId=${encodeURIComponent(selectedStreakUser.userId || "")}`
            : null,
        fetcher
    );

    const { data: itemUsers } = useSWR<{ users: any[] }>(
        selectedItem
            ? `/api/statistics/items?ratingKey=${selectedItem.ratingKey}&serverId=${selectedItem.serverId}&range=${selectedItem.source === 'most_watched' ? mostWatchedRange : popularRange}&type=${(selectedItem.source === 'most_watched' ? activeMostWatchedTab : activeTab) === 'shows' ? 'show' : ''}&sort=${selectedItem.source === 'most_watched' ? 'total_plays' : 'unique_users'}`
            : null,
        fetcher
    );



    const maxConcurrentStreams = snapshot?.count || 0;
    const peakDate = snapshot?.timestamp ? formatDateTime(snapshot.timestamp) : null;

    // Helper to get active data
    const getActiveData = () => {
        switch (activeTab) {
            case 'movies': return popularMovies;
            case 'episodes': return popularEpisodes;
            case 'shows': return popularSeries;
            default: return popularMovies;
        }
    };

    const getActiveMostWatchedData = () => {
        switch (activeMostWatchedTab) {
            case 'movies': return mostWatchedMovies;
            case 'episodes': return mostWatchedEpisodes;
            case 'shows': return mostWatchedSeries;
            default: return mostWatchedMovies;
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                            {t("dashboard.statistics")}
                        </h1>
                        <p className="text-gray-400 mt-2">View historical data and usage metrics.</p>
                    </div>
                </div>
                <UserMenu />
            </header>

            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-amber-500" />
                        <h2 className="text-xl font-semibold text-white">Watch Statistics</h2>
                    </div>
                    <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                        {(["24h", "7d", "30d", "all"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${range === r
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {r === "all" ? "All Time" : r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Concurrent Streams Card (Existing) */}
                    <button
                        onClick={() => snapshot?.count && setIsModalOpen(true)}
                        className="text-left bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-amber-500/50 hover:bg-gray-900/80 transition-all group relative overflow-hidden h-[180px] flex flex-col justify-between"
                    >
                        <div className="flex items-start justify-between relative z-10 w-full">
                            <div>
                                <p className="text-gray-400 text-sm font-medium mb-1">Most Concurrent Streams</p>
                                <p className="text-3xl font-bold text-white group-hover:text-amber-500 transition-colors">
                                    {maxConcurrentStreams}
                                </p>
                            </div>
                            <div className="bg-amber-500/10 p-2 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                                <Tv className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>
                        <div className="mt-auto">
                            <p className="text-xs text-gray-500">
                                {range === 'all' ? "All time high peak" : `Peak in the last ${range}`}
                            </p>
                            {peakDate && (
                                <p className="text-[10px] text-gray-600 mt-1 truncate">
                                    {peakDate}
                                </p>
                            )}
                        </div>
                    </button>

                    {/* Combined Total Plays & Most Active Users Card */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-0 hover:border-blue-500/50 transition-all group relative overflow-hidden flex flex-col h-[180px]">

                        {/* Content Area */}
                        <div className="flex-1 relative overflow-hidden">
                            {/* View 0: Total Plays */}
                            <div
                                className={`absolute inset-0 p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out ${activePlaysCardIndex === 0 ? 'translate-x-0' : '-translate-x-full'}`}
                                style={{ pointerEvents: activePlaysCardIndex === 0 ? 'auto' : 'none' }}
                            >
                                <div className="flex items-start justify-between relative z-10">
                                    <div>
                                        <p className="text-gray-400 text-sm font-medium mb-1">Total Plays</p>
                                        <p className="text-3xl font-bold text-white group-hover:text-blue-500 transition-colors">
                                            {summaryStats?.totalPlays || 0}
                                        </p>
                                    </div>
                                    <div className="bg-blue-500/10 p-2 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                        <Play className="w-5 h-5 text-blue-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-auto">
                                    Streams started in {range}
                                </p>
                            </div>

                            {/* View 1: Most Active Users List */}
                            <div
                                className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out ${activePlaysCardIndex === 1 ? 'translate-x-0' : 'translate-x-full'}`}
                                style={{ pointerEvents: activePlaysCardIndex === 1 ? 'auto' : 'none' }}
                            >
                                <div className="p-4 pb-2 border-b border-gray-800 flex justify-between items-center bg-gray-900/30 shrink-0">
                                    <span className="text-gray-400 text-sm font-medium">Most Active Users</span>
                                    <div className="bg-green-500/10 p-1.5 rounded-lg group-hover:bg-green-500/20 transition-colors">
                                        <Users className="w-4 h-4 text-green-500" />
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                    {(summaryStats?.topUsers || []).map((user, i) => (
                                        <div key={user.username} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs font-bold text-gray-500 w-4">{i + 1}.</span>
                                                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
                                                    {user.username.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-gray-200 truncate font-medium">{user.username}</span>
                                            </div>
                                            <span className="text-xs font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded ml-2">
                                                {user.plays}
                                            </span>
                                        </div>
                                    ))}
                                    {(!summaryStats?.topUsers || summaryStats.topUsers.length === 0) && (
                                        <div className="px-4 py-8 text-center text-xs text-gray-500">No active users</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pagination Dots */}
                        <div className="h-6 flex items-center justify-center gap-2 border-t border-gray-800 bg-gray-900/30 shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActivePlaysCardIndex(0); }}
                                className={`w-2 h-2 rounded-full transition-all ${activePlaysCardIndex === 0 ? 'bg-blue-500 w-3' : 'bg-gray-600 hover:bg-gray-500'}`}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); setActivePlaysCardIndex(1); }}
                                className={`w-2 h-2 rounded-full transition-all ${activePlaysCardIndex === 1 ? 'bg-green-500 w-3' : 'bg-gray-600 hover:bg-gray-500'}`}
                            />
                        </div>
                    </div>

                    {/* Total Duration / Unique Users Split (Optional, or just Duration) */}
                    {/* Total Duration / Unique Users Split (Carousel) */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-0 hover:border-purple-500/50 transition-all group relative overflow-hidden flex flex-col h-[180px]">

                        {/* Content Carousel */}
                        <div className="flex-1 relative overflow-hidden">
                            {[
                                { unit: 'Hours', div: 1, suffix: 'hrs', label: 'Total Hours' },
                                { unit: 'Days', div: 24, suffix: 'days', label: 'Total Days' },
                                { unit: 'Months', div: 24 * 30, suffix: 'mo', label: 'Total Months' },
                                { unit: 'Years', div: 24 * 365, suffix: 'yrs', label: 'Total Years' }
                            ].map((item, idx) => (
                                <div
                                    key={item.unit}
                                    className={`absolute inset-0 p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out`}
                                    style={{
                                        transform: `translateX(${(idx - activePlayTimeIndex) * 100}%)`,
                                        opacity: Math.abs(idx - activePlayTimeIndex) <= 1 ? 1 : 0, // Optimization
                                        pointerEvents: idx === activePlayTimeIndex ? 'auto' : 'none'
                                    }}
                                >
                                    <div className="flex items-start justify-between relative z-10 w-full">
                                        <div>
                                            <p className="text-gray-400 text-sm font-medium mb-1">{item.label}</p>
                                            <p className="text-3xl font-bold text-white group-hover:text-purple-500 transition-colors">
                                                {summaryStats?.totalDurationHours
                                                    ? (summaryStats.totalDurationHours / item.div).toLocaleString(undefined, { maximumFractionDigits: 1 })
                                                    : 0}
                                                <span className="text-base font-normal text-gray-500 ml-1">{item.suffix}</span>
                                            </p>
                                        </div>
                                        <div className="bg-purple-500/10 p-2 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                                            <Clock className="w-5 h-5 text-purple-500" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-auto">
                                        Across {summaryStats?.uniqueUsers || 0} unique users
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Dots */}
                        <div className="h-6 flex items-center justify-center gap-2 border-t border-gray-800 bg-gray-900/30 shrink-0">
                            {[0, 1, 2, 3].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { e.stopPropagation(); setActivePlayTimeIndex(idx); }}
                                    className={`w-2 h-2 rounded-full transition-all ${activePlayTimeIndex === idx ? 'bg-purple-500 w-3' : 'bg-gray-600 hover:bg-gray-500'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Top Streaks Card */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-0 hover:border-orange-500/50 transition-all group relative overflow-hidden flex flex-col h-[180px]">
                        <div className="p-4 pb-2 border-b border-gray-800 flex justify-between items-center bg-gray-900/30 shrink-0">
                            <span className="text-gray-400 text-sm font-medium">Top Streaks</span>
                            <div className="bg-orange-500/10 p-1.5 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {(streaksData?.topStreaks || []).map((user: any, i: number) => (
                                <button
                                    key={`${user.username}-${i}`}
                                    onClick={() => setSelectedStreakUser({ username: user.username, userId: user.userId })}
                                    className="w-full flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors text-left group/user"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-xs font-bold w-4 ${i < 3 ? 'text-amber-500' : 'text-gray-500'}`}>#{i + 1}</span>
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
                                            {user.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-gray-200 truncate font-medium group-hover/user:text-white transition-colors">{user.username}</span>
                                    </div>
                                    <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded ml-2 flex items-center gap-1">
                                        {user.currentStreak}d
                                    </span>
                                </button>
                            ))}
                            {(!streaksData?.topStreaks || streaksData.topStreaks.length === 0) && (
                                <div className="px-4 py-8 text-center text-xs text-gray-500">No active streaks</div>
                            )}
                        </div>
                    </div>

                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-amber-500" />
                            <h2 className="text-xl font-semibold text-white">Popular Content</h2>
                        </div>

                        <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                            <button
                                onClick={() => setActiveTab('movies')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'movies'
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Movies
                            </button>
                            <button
                                onClick={() => setActiveTab('shows')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'shows'
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                TV Shows
                            </button>
                            <button
                                onClick={() => setActiveTab('episodes')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'episodes'
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Episodes
                            </button>
                        </div>
                    </div>

                    <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                        {(["24h", "7d", "30d", "all"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setPopularRange(r)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${popularRange === r
                                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {r === "all" ? "All Time" : r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {!getActiveData() ? (
                        // Loading State
                        Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    ) : getActiveData()?.data?.length === 0 ? (
                        // Empty State
                        <div className="w-full text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-gray-700 shrink-0">
                            No popular content found for this period
                        </div>
                    ) : (
                        // Data State
                        getActiveData()?.data?.map((item: any, i: number) => (
                            <div
                                key={`${item.ratingKey}-${item.serverId}`}
                                onClick={() => setSelectedItem({ ...item, source: 'popular' })}
                                className="bg-gray-800/50 rounded-xl p-4 flex gap-4 min-w-[300px] hover:bg-gray-800 transition-colors cursor-pointer border border-gray-700/50 hover:border-gray-600 group shrink-0"
                            >
                                <div className="relative w-16 h-24 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden shadow-md">
                                    {item.thumb ? (
                                        <img
                                            src={item.thumb}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                                            <div className="w-8 h-8 rounded-full bg-gray-800" />
                                        </div>
                                    )}
                                    <div className="absolute top-0 left-0 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-br-lg shadow-sm">
                                        #{i + 1}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <h3 className="font-medium text-gray-100 truncate pr-2" title={item.title}>
                                        {item.title}
                                    </h3>
                                    <div className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                                        <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-medium border border-blue-500/20">
                                            {item.count} unique users
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Play className="w-5 h-5 text-green-500" />
                            <h2 className="text-xl font-semibold text-white">Most Watched Content</h2>
                        </div>

                        <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                            <button
                                onClick={() => setActiveMostWatchedTab('movies')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeMostWatchedTab === 'movies'
                                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Movies
                            </button>
                            <button
                                onClick={() => setActiveMostWatchedTab('shows')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeMostWatchedTab === 'shows'
                                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                TV Shows
                            </button>
                            <button
                                onClick={() => setActiveMostWatchedTab('episodes')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeMostWatchedTab === 'episodes'
                                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Episodes
                            </button>
                        </div>
                    </div>

                    <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                        {(["24h", "7d", "30d", "all"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setMostWatchedRange(r)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mostWatchedRange === r
                                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {r === "all" ? "All Time" : r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {!getActiveMostWatchedData() ? (
                        // Loading State
                        Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    ) : getActiveMostWatchedData()?.data?.length === 0 ? (
                        // Empty State
                        <div className="w-full text-center py-12 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-gray-700 shrink-0">
                            No watched content found for this period
                        </div>
                    ) : (
                        // Data State
                        getActiveMostWatchedData()?.data?.map((item: any, i: number) => (
                            <div
                                key={`mw-${item.ratingKey}-${item.serverId}`}
                                onClick={() => setSelectedItem({ ...item, source: 'most_watched' })}
                                className="bg-gray-800/50 rounded-xl p-4 flex gap-4 min-w-[300px] hover:bg-gray-800 transition-colors cursor-pointer border border-gray-700/50 hover:border-gray-600 group shrink-0"
                            >
                                <div className="relative w-16 h-24 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden shadow-md">
                                    {item.thumb ? (
                                        <img
                                            src={item.thumb}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                                            <div className="w-8 h-8 rounded-full bg-gray-800" />
                                        </div>
                                    )}
                                    <div className="absolute top-0 left-0 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-br-lg shadow-sm">
                                        #{i + 1}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <h3 className="font-medium text-gray-100 truncate pr-2" title={item.title}>
                                        {item.title}
                                    </h3>
                                    <div className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                                        <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-xs font-medium border border-green-500/20">
                                            {item.count} plays
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Concurrent Detail Modal */}
            {isModalOpen && snapshot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h3 className="text-xl font-bold text-white">Peak Details</h3>
                                <p className="text-sm text-gray-400">{peakDate}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="space-y-3">
                                {snapshot.sessions.map((session: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {session.userThumb ? (
                                                <img src={session.userThumb} alt={session.user} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold text-white/50">
                                                    {session.user.substring(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-white truncate">{session.user}</p>
                                            <p className="text-xs text-amber-400 truncate">{session.title}</p>
                                        </div>
                                        <div className="text-xs text-gray-500 shrink-0">
                                            {session.player}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Streak Details Modal */}
            {selectedStreakUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {selectedStreakUser.username}
                                    <span className="text-sm font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                        {streakDetails?.streakCount || 0} Day Streak
                                    </span>
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Daily Breakdown</p>
                            </div>
                            <button
                                onClick={() => setSelectedStreakUser(null)}
                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {!streakDetails ? (
                                <div className="text-center py-8 text-gray-500">Loading details...</div>
                            ) : streakDetails.history.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No history found.</div>
                            ) : (
                                <div className="relative border-l-2 border-white/10 ml-3 space-y-8">
                                    {streakDetails.history.map((day: any, i: number) => (
                                        <div key={day.date} className="relative pl-6">
                                            {/* Timeline Dot */}
                                            <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-orange-500 shadow-lg shadow-orange-500/50' : 'bg-gray-700'}`} />

                                            <div className="flex items-baseline justify-between mb-2">
                                                <h4 className={`font-semibold ${i === 0 ? 'text-white' : 'text-gray-400'}`}>
                                                    {formatDate(day.date)}
                                                </h4>
                                                <span className="text-xs text-gray-500 font-medium bg-white/5 px-1.5 py-0.5 rounded">
                                                    {Math.round((day.totalDuration || 0) / 60)} min
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {day.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex gap-3 bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors border border-white/5">
                                                        <div className="h-10 w-7 bg-gray-800 rounded overflow-hidden shrink-0">
                                                            {item.thumb ? (
                                                                <img src={item.thumb} alt={item.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-700" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1 py-0.5">
                                                            <p className="text-xs font-medium text-gray-200 truncate" title={item.title}>
                                                                {item.title}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                                                {Math.round(item.duration / 60)}m • {formatTime(item.time)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl shrink-0">
                            <button
                                onClick={() => setSelectedStreakUser(null)}
                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Popular Item Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div className="flex items-center gap-4">
                                {selectedItem.thumb && (
                                    <div className="h-12 w-9 bg-gray-800 rounded overflow-hidden shrink-0">
                                        <img src={selectedItem.thumb} alt={selectedItem.title} className="h-full w-full object-cover" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-white truncate max-w-[200px]">{selectedItem.title}</h3>
                                    <p className="text-sm text-gray-400">
                                        {selectedItem.source === 'most_watched'
                                            ? `Watched ${itemUsers?.users?.reduce((acc: number, u: any) => acc + u.playCount, 0) || 0} times`
                                            : `Watched by ${itemUsers?.users?.length || 0} users`} in {selectedItem.source === 'most_watched' ? (mostWatchedRange === 'all' ? 'All Time' : mostWatchedRange) : (popularRange === 'all' ? 'All Time' : popularRange)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {!itemUsers ? (
                                <div className="text-center py-8 text-gray-500">Loading details...</div>
                            ) : itemUsers?.users?.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No users found.</div>
                            ) : (
                                <div className="space-y-3">
                                    {itemUsers?.users?.map((user: any, i: number) => (
                                        <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                    <span className="text-xs font-bold text-white/50">
                                                        {user.user.substring(0, 2).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-white truncate">{user.user}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {user.playCount} plays {user.playCount > 1 ? '(Total)' : ''}
                                                    </p>
                                                </div>
                                                <div className="text-xs text-amber-400 shrink-0 text-right">
                                                    Last: {formatDate(user.lastWatched)}
                                                </div>
                                            </div>

                                            {/* Detailed Plays List */}
                                            {user.plays && user.plays.length > 0 && (
                                                <div className="mt-2 space-y-1 pl-11 border-l-2 border-white/5 ml-4">
                                                    {user.plays.map((play: any, idx: number) => (
                                                        <div key={idx} className="text-xs flex justify-between items-center group/play py-0.5">
                                                            <div className="truncate text-gray-400 group-hover/play:text-gray-300">
                                                                {play.title}
                                                            </div>
                                                            <div className="flex gap-2 text-[10px] text-gray-600">
                                                                <span>{play.percent}%</span>
                                                                <span>{formatDate(play.date)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
