"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageContext";
import { ChevronLeft, ChevronRight, Play, Server, Info, History, X, Search, ChevronDown } from "lucide-react";
import { useState, use } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { bundleHistoryEntries } from "@/components/BundlingHelpers";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export default function ClientPage({ id, group }: { id: string, group: any }) {
    const { t } = useLanguage();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const { data, error, isLoading } = useSWR<{ items: any[], totalCount: number, group?: { name: string } }>(
        `/api/library-groups/${id}/items?page=${page}&pageSize=${pageSize}&search=${searchQuery}`,
        fetchJson,
        { refreshInterval: 0, keepPreviousData: true }
    );

    const totalCount = data?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500/30">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-5%] top-[-10%] h-80 w-80 rounded-full bg-amber-400/10 blur-3xl opacity-40" />
                <div className="absolute right-[-10%] top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl opacity-30" />
            </div>

            <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
                <header className="mb-8 flex items-center justify-between">
                    <Link
                        href="/settings/servers?tab=libraries"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:border-white/20"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {t("common.back")}
                    </Link>
                    <h1 className="text-2xl font-bold">{group?.name || data?.group?.name || "Unified Library"}</h1>
                </header>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
                    {/* Pagination Controls (Sticky) */}
                    <div className="sticky top-0 z-20 -mx-8 -mt-8 px-8 py-6 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 rounded-t-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-white/50 font-medium">
                            {totalCount > 0 ? (
                                <span>Showing <span className="text-white font-bold">{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)}</span> of <span className="text-white font-bold">{totalCount}</span> items</span>
                            ) : (
                                <span>No items found</span>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none [&>option]:bg-slate-900"
                            >
                                {[25, 50, 100, 250].map(size => (
                                    <option key={size} value={size}>{size} / page</option>
                                ))}
                            </select>

                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-48 bg-black/20 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:w-64 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/10">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-4 text-xs font-bold font-mono min-w-[80px] text-center">
                                    {isLoading ? "..." : `${page} / ${totalPages || 1}`}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || isLoading}
                                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-rose-400">Failed to load items.</p>
                        </div>
                    ) : (data?.items?.length ?? 0) === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-white/50">No items in this group.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {data?.items.map((item, index) => {
                                return (
                                    <div
                                        key={`${item.id}-${index}`}
                                        className="group flex flex-col gap-2 cursor-pointer"
                                        onClick={() => setSelectedItem(item)}
                                    >
                                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-900 shadow-lg transition group-hover:scale-105 group-hover:shadow-2xl ring-1 ring-white/10">
                                            {item.posterPath ? (
                                                <img
                                                    src={item.posterPath}
                                                    alt={item.title}
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-white/20 font-bold p-4 text-center">
                                                    <span>{item.title}</span>
                                                    {item.sources.length > 1 && (
                                                        <span className="mt-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded-full">
                                                            {item.sources.length} Sources
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate font-medium text-white text-sm" title={item.title}>{item.title}</p>
                                            <div className="flex justify-between items-center text-xs text-white/40">
                                                <span>{item.year}</span>
                                                {item.externalIds.imdb && <span className="bg-[#f5c518] text-black px-1 rounded-[2px] font-bold text-[8px]">IMDb</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Statistics Modal */}
                {selectedItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="flex items-start justify-between p-6 border-b border-white/5 bg-white/5">
                                <div className="flex gap-4">
                                    <div className="h-16 w-12 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                                        {selectedItem.posterPath ? (
                                            <img src={selectedItem.posterPath} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xs text-white/20">{selectedItem.type}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedItem.title}</h3>
                                        <div className="flex items-center gap-2 text-white/50 text-sm">
                                            <span>{selectedItem.year}</span>
                                            <span>•</span>
                                            <span className="capitalize">{selectedItem.type}</span>
                                            {selectedItem.duration && (
                                                <>
                                                    <span>•</span>
                                                    <span>
                                                        {Math.floor(selectedItem.duration / 3600000) > 0
                                                            ? `${Math.floor(selectedItem.duration / 3600000)}h ${Math.round((selectedItem.duration % 3600000) / 60000)}m`
                                                            : `${Math.round(selectedItem.duration / 60000)}m`}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-white/50" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <MediaStatsDashboard item={selectedItem} />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// --- Sub-Components ---
function MediaStatsDashboard({ item }: { item: any }) {
    const { data: stats, error, isLoading } = useSWR(
        item ? [`/api/stats/media`, item.id] : null,
        () => fetch('/api/stats/media', {
            method: 'POST',
            body: JSON.stringify({ items: item })
        }).then(r => r.json())
    );

    const [selectedSeason, setSelectedSeason] = useState<number>(-1);
    const [selectedEpisode, setSelectedEpisode] = useState<any | null>(null);

    // Effect to auto-select -1 (All) for shows
    // (State defaults to -1, so we don't need to force it, but if data loads we ensure it's valid?)
    // Actually, let's keep it simple. Default is -1.

    if (isLoading) return <div className="text-center py-12 text-white/30 animate-pulse">Loading statistics...</div>;
    if (error || !stats || stats.error || !stats.stats) {
        console.error("Stats Error:", error || stats?.error);
        return <div className="text-center py-12 text-rose-400">Failed to load statistics.</div>;
    }

    const rootStats = stats.stats;

    // Derived stats based on selection
    let displayStats: {
        plays: any;
        users: any;
        history: any[];
        userOverview?: any[];
        episodeCount?: number;
    } = {
        plays: rootStats.totalPlays,
        users: rootStats.uniqueUsers,
        history: rootStats.history || []
    };

    let activeTitle = "Overview";

    if (stats.type === 'show') {
        if (selectedEpisode) {
            displayStats = {
                plays: selectedEpisode.stats.plays,
                users: selectedEpisode.stats.uniqueUsers,
                history: selectedEpisode.stats.history
            };
            activeTitle = `${selectedEpisode.index}. ${selectedEpisode.title}`;
        } else if (selectedSeason !== -1) {
            // Aggregate stats for the selected season
            const season = rootStats.seasons.find((s: any) => s.index === selectedSeason);
            if (season) {
                const seasonEps = season.episodes || [];
                // Collect all episode RatingKeys in this season
                const seasonKeys = new Set(seasonEps.map((ep: any) => ep.ratingKey));

                // Filter global history for plays matching this season
                const seasonHistory = (rootStats.history || []).filter((h: any) => seasonKeys.has(h.ratingKey));

                displayStats = {
                    plays: season.stats?.totalPlays ?? 0,
                    users: season.stats?.uniqueUsers ?? 0,
                    history: seasonHistory,
                    // Use server-provided season stats if available
                    userOverview: season.userOverview || [],
                    episodeCount: season.episodeCount || 0
                };
            }
        }
    }

    // Badge Logic
    let badge = null;
    if (stats.type === 'show') {
        let isWatched = false;
        let label = "";

        if (selectedEpisode) {
            isWatched = selectedEpisode.isWatched;
            label = isWatched ? "Watched" : "Unwatched";
        } else if (selectedSeason !== -1) {
            const season = rootStats.seasons.find((s: any) => s.index === selectedSeason);
            if (season) {
                const total = season.episodeCount || 0;
                const watched = season.watchedEpisodeCount || 0;
                isWatched = total > 0 && total === watched;
                label = `Watched ${watched}/${total}`;
            }
        } else {
            // All Seasons
            const total = rootStats.episodeCount || 0;
            const watched = rootStats.watchedEpisodeCount || 0;
            isWatched = total > 0 && total === watched;
            label = `Watched ${watched}/${total}`;
        }

        badge = (
            <div className={clsx(
                "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2",
                isWatched
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-orange-500/10 text-orange-400 border-orange-500/20"
            )}>
                <div className={clsx("w-2 h-2 rounded-full", isWatched ? "bg-emerald-500" : "bg-orange-500")} />
                {label}
            </div>
        );
    }

    // Determine what to show: User Overview or History Log
    // Show User Overview if:
    // 1. All Seasons is selected (selectedSeason == -1)
    // 2. A specific Season is selected BUT NO specific episode is selected (selectedSeason != -1 && !selectedEpisode)
    const showUserOverview = (selectedSeason === -1 || !selectedEpisode) && stats.type === 'show';
    const userOverviewData = selectedSeason === -1 ? rootStats.userOverview : displayStats.userOverview;
    const totalEpisodesForProgress = selectedSeason === -1 ? rootStats.episodeCount : displayStats.episodeCount;

    // Apply Bundling to History
    const historyBundles = !showUserOverview ? bundleHistoryEntries(displayStats.history, { skipItemCheck: stats.type === 'movie' }) : [];

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="text-xs text-indigo-300 uppercase tracking-wider font-bold mb-1">Total Plays</div>
                    <div className="text-3xl font-bold text-white">{displayStats.plays}</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="text-xs text-purple-300 uppercase tracking-wider font-bold mb-1">Unique Users</div>
                    <div className="text-3xl font-bold text-white">{displayStats.users}</div>
                </div>
                {/* Placeholder for Duration or Last Played */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs text-emerald-300 uppercase tracking-wider font-bold mb-1">Last Played</div>
                    <div className="text-xl font-bold text-white truncate">
                        {(displayStats as any).lastPlayed
                            ? new Date((displayStats as any).lastPlayed).toLocaleDateString('sv-SE')
                            : (displayStats.history[0] ? new Date(displayStats.history[0].startTime).toLocaleDateString('sv-SE') : 'Never')}
                    </div>
                </div>
            </div>

            {/* Watch Status Badge */}
            {badge && (
                <div className="flex justify-end">
                    {badge}
                </div>
            )}

            {/* Show Controls (Dropdowns) */}
            {stats.type === 'show' && rootStats.seasons && (
                <div className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    {/* Season Select */}
                    <div className="flex-1 max-w-[200px] space-y-1">
                        <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Season</label>
                        <select
                            className="w-full bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            value={selectedSeason}
                            onChange={(e) => {
                                const sIdx = Number(e.target.value);
                                setSelectedSeason(sIdx);
                                setSelectedEpisode(null);
                            }}
                        >
                            <option value="-1">All Seasons</option>
                            {rootStats.seasons.map((s: any) => (
                                <option key={s.index} value={s.index}>Season {s.index}</option>
                            ))}
                        </select>
                    </div>

                    {/* Episode Select */}
                    <div className="flex-1 max-w-[300px] space-y-1">
                        <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Episode</label>
                        <select
                            className="w-full bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            value={selectedEpisode?.ratingKey || ''}
                            onChange={(e) => {
                                const epKey = e.target.value;
                                const season = rootStats.seasons.find((s: any) => s.index === selectedSeason);
                                const ep = season?.episodes.find((e: any) => e.ratingKey === epKey);
                                setSelectedEpisode(ep || null);
                            }}
                            disabled={selectedSeason === -1}
                        >
                            <option value="">{selectedSeason === -1 ? "All Episodes" : "All Episodes (Season Stats)"}</option>
                            {rootStats.seasons.find((s: any) => s.index === selectedSeason)?.episodes.map((ep: any) => (
                                <option key={ep.ratingKey} value={ep.ratingKey}>
                                    {ep.index}. {ep.title} {ep.stats.plays > 0 ? `(${ep.stats.plays} plays)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Content Area: User Overview OR History Log */}
            <div>
                {showUserOverview && userOverviewData ? (
                    /* User Overview Table */
                    <div>
                        <h4 className="font-bold text-white/50 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            User Overview: <span className="text-white">{selectedSeason === -1 ? "All Seasons" : `Season ${selectedSeason}`}</span>
                        </h4>
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/50 font-medium">
                                    <tr>
                                        <th className="p-3">User</th>
                                        <th className="p-3">Progress</th>
                                        <th className="p-3">Last Activity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {userOverviewData.map((u: any) => (
                                        <tr key={u.user} className="hover:bg-white/5">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
                                                        {u.userThumb ? <img src={u.userThumb} className="w-full h-full rounded-full object-cover" /> : u.user.substring(0, 1)}
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-medium">{u.user}</div>
                                                        <div className="text-xs text-white/40">{u.lastEpisodeTitle}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${Math.min(100, (u.episodeCount / totalEpisodesForProgress) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white/60 text-xs font-mono">
                                                        {u.episodeCount}/{totalEpisodesForProgress}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-white/60 font-mono text-xs">
                                                {new Date(u.lastPlayed).toLocaleDateString("sv-SE")}
                                            </td>
                                        </tr>
                                    ))}
                                    {userOverviewData.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-white/30">No viewing activity found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* History Log */
                    <div>
                        <h4 className="font-bold text-white/50 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            History Log: <span className="text-white">{activeTitle}</span>
                        </h4>
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/50 font-medium">
                                    <tr>
                                        <th className="p-3">User</th>
                                        {stats.type === 'show' && <th className="p-3">Episode</th>}
                                        <th className="p-3">Server</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3 text-right">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {historyBundles.length > 0 ? historyBundles.map((b: any, i: number) => (
                                        <UnifiedHistoryRow key={i} bundle={b} showEpisode={stats.type === 'show'} />
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-white/30">No history found for this selection.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function UnifiedHistoryRow({ bundle, showEpisode }: { bundle: any, showEpisode: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);
    // Bundle entry is the LATEST session (desc sort)
    const { entry, subEntries } = bundle;
    const isBundle = bundle.type === 'bundle';

    // Calculate aggregated duration
    const totalDuration = subEntries.length > 0
        ? subEntries.reduce((acc: number, curr: any) => acc + curr.duration, 0)
        : entry.duration;

    return (
        <>
            <tr
                className={clsx(
                    "hover:bg-white/5 transition-colors cursor-pointer",
                    isExpanded && "bg-white/5"
                )}
                onClick={() => isBundle && setIsExpanded(!isExpanded)}
            >
                <td className="p-3">
                    <div className="flex items-center gap-2">
                        {isBundle && (
                            <div className="mr-1 text-white/50">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </div>
                        )}
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                            {entry.userThumb ? <img src={entry.userThumb} className="w-full h-full rounded-full object-cover" /> : entry.user.substring(0, 1)}
                        </div>
                        <span className="text-white text-xs">{entry.user}</span>
                        {isBundle && (
                            <span className="text-[9px] bg-white/10 px-1.5 rounded text-white/50">{subEntries.length} sessions</span>
                        )}
                    </div>
                </td>
                {showEpisode && (
                    <td className="p-3 text-white text-xs">
                        {entry.episodeTitle || <span className="text-white/20">-</span>}
                    </td>
                )}
                <td className="p-3 text-white/60 text-xs">
                    {entry.serverName || "Unknown"}
                </td>
                <td className="p-3 text-white/60 text-xs">
                    {new Date(entry.startTime).toLocaleDateString("sv-SE")}
                </td>
                <td className="p-3 text-right text-white/60 font-mono text-xs">
                    {Math.round(totalDuration / 60)}m
                </td>
            </tr>
            {isExpanded && subEntries.map((sub: any, idx: number) => {
                // Determine session type based on reverse index (since subEntries are sorted DESC)
                // The OLDEST one (last in list) is "Initial Session".
                const isInitial = idx === subEntries.length - 1;

                return (
                    <tr key={sub.id || idx} className="bg-white/[0.02] border-b border-white/5 last:border-0 hover:bg-white/[0.04]">
                        <td className="p-3 pl-12 text-xs text-white/50">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                {isInitial ? "Initial Session" : "Resume from continue watching"}
                            </div>
                        </td>
                        {showEpisode && <td className="p-3"></td>}
                        <td className="p-3 text-white/30 text-[10px]">{sub.serverName}</td>
                        <td className="p-3 text-white/30 text-[10px] font-mono">
                            {new Date(sub.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                        <td className="p-3 text-right text-white/30 text-[10px] font-mono">
                            {Math.round(sub.duration / 60)}m
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
