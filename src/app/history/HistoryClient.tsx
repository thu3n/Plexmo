"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { HistoryList } from "@/features/history/components/HistoryList";
import { HISTORY_PAGE_SIZES, useHistoryPageSize } from "@/features/history/lib/history-page-size";
import type { HistoryEntry } from "@/lib/history";
import { Suspense, useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { Search, Filter, Trash2, Edit2, Calendar, ChevronLeft, ChevronRight, X, ArrowUp } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { SkeletonRows } from "@/components/Skeleton";
import { fetchJsonOrThrow as fetchJson } from "@/lib/swr-fetch";
import clsx from "clsx";

// API Response type
type HistoryApiResponse = {
    history: HistoryEntry[];
    activeSessions: HistoryEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
};

function HistoryContent({ timeZone }: { timeZone: string }) {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<string>("all");
    const [selectedServer, setSelectedServer] = useState<string>("all");
    const [isEditing, setIsEditing] = useState(false);


    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useHistoryPageSize();

    // Collapsible search/filters (collapsed by default — only pagination shows initially)
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Scroll-to-top button visibility
    const [showTop, setShowTop] = useState(false);
    // Whether the sticky filter bar has detached from the top (drives its backdrop)
    const [scrolled, setScrolled] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Track scroll: backdrop on the sticky bar once detached, scroll-to-top past the fold
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            setScrolled(y > 10);
            setShowTop(y > 400);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedUser, selectedServer, pageSize]);

    // Fetch servers for filtering
    const { data: serverData } = useSWR<{ servers: { id: string; name: string }[] }>('/api/servers', fetchJson);
    const servers = serverData?.servers.sort((a, b) => a.name.localeCompare(b.name)) || [];

    // Construct API URL with params
    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });

    if (selectedServer !== "all") queryParams.set("serverId", selectedServer);
    if (selectedUser !== "all") queryParams.set("userId", selectedUser);
    if (debouncedSearch) queryParams.set("search", debouncedSearch);

    // Fetch history from backend
    const { data, isLoading, error } = useSWR<HistoryApiResponse>(
        `/api/history?${queryParams.toString()}`,
        fetchJson,
        {
            refreshInterval: 10000,
            revalidateOnFocus: true,
            keepPreviousData: true, // Smoother pagination
        }
    );

    // Combine Active Sessions (only on page 1) + History
    let displayHistory: HistoryEntry[] = [];
    if (data) {
        if (page === 1) {
            displayHistory = [...data.activeSessions, ...data.history];
        } else {
            displayHistory = data.history;
        }
    }

    // Fetch users for filtering
    const { data: userData } = useSWR<{ users: { username: string; title: string }[] }>('/api/users', fetchJson);
    const users = (userData?.users || []).sort((a, b) => (a.title || a.username).localeCompare(b.title || b.username));

    // Deduplicate by username just in case
    const uniqueUsers = Array.from(new Map(users.map(u => [u.username, u])).values());

    const totalCount = data?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="flex min-h-dvh safe-x bg-slate-950 text-white selection:bg-amber-500/30 font-sans">
            {/* Ambient Background - reusing the effect from SettingsLayout */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)] opacity-40 mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.05),transparent)] opacity-40 mix-blend-screen" />
            </div>

            {/* Fixed header — same pattern/height as Statistics/Libraries so
                the nav doesn't jump between pages */}
            <header className="fixed top-0 inset-x-0 z-50 border-b bg-black/80 border-white/5 safe-top">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-white/90">{t("history.title")}</h1>
                    <div className="flex items-center gap-4">
                        <HeaderNav />
                        <UserMenu align="top-right" />
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col min-w-0 relative z-10 max-w-[1600px] mx-auto w-full px-4 sm:px-6 main-safe-top pb-dock">

                {/* Filters & Controls — backdrop appears only once the bar detaches on scroll */}
                {/* Constant padding + negative margins: the controls occupy their
                    at-top position always; only the backdrop fades in around them */}
                <div className={clsx(
                    "sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-40 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between transition-all duration-300 rounded-3xl p-4 -mx-4 -mt-4 mb-4",
                    scrolled && "bg-slate-950/95 shadow-2xl"
                )}>
                    <div className={clsx("flex-col sm:flex-row gap-3 flex-1", filtersOpen ? "flex" : "hidden lg:flex")}>
                        {/* Search */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder={t("common.search") + "..."}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:bg-black/40 transition-all placeholder:text-white/20"
                            />
                        </div>

                        {/* Server Filter */}
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                            <select
                                value={selectedServer}
                                onChange={(e) => {
                                    setSelectedServer(e.target.value);
                                    setSelectedUser("all");
                                }}
                                className="h-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-8 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:bg-black/40 transition-all appearance-none [&>option]:bg-slate-900 min-w-[160px]"
                            >
                                <option value="all">{t("settings.allServers")}</option>
                                {servers.map((server) => (
                                    <option key={server.id} value={server.id}>{server.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* User Filter */}
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 flex items-center justify-center font-bold text-[10px] pointer-events-none">U</div>
                            <select
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                className="h-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-8 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:bg-black/40 transition-all appearance-none [&>option]:bg-slate-900 min-w-[160px]"
                            >
                                <option value="all">{t("history.allUsers")}</option>
                                {uniqueUsers.map((user) => (
                                    <option key={user.username} value={user.username}>{user.title || user.username}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={clsx("h-px bg-white/10 w-full lg:w-px lg:h-8", filtersOpen ? "block" : "hidden lg:block")} />

                    {/* Pagination + Filters toggle (toggle is mobile-only) */}
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(v => !v)}
                            title={filtersOpen ? "Hide filters" : "Show filters"}
                            className={clsx(
                                "lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                                filtersOpen
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                    : "bg-black/20 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            <span className="hidden sm:inline">{t("common.search")}</span>
                        </button>

                        {/* Edit mode lives with the list controls, not the header */}
                        {isEditing && (
                            <button
                                onClick={async () => {
                                    if (confirm("ARE YOU SURE? This will delete ALL history entries permanently!")) {
                                        await fetch("/api/history", {
                                            method: "DELETE",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ all: true }),
                                        });
                                        location.reload();
                                    }
                                }}
                                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Clear All</span>
                            </button>
                        )}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={clsx(
                                "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap",
                                isEditing
                                    ? "bg-amber-500 text-slate-900 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                    : "bg-black/20 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            <span className="hidden sm:inline">{isEditing ? t("common.cancel") : t("common.edit")}</span>
                        </button>

                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none [&>option]:bg-slate-900"
                        >
                            {HISTORY_PAGE_SIZES.map(size => (
                                <option key={size} value={size}>{size} / page</option>
                            ))}
                        </select>

                        <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/10">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-2 sm:px-4 text-xs font-bold font-mono min-w-[64px] text-center">
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

                {error && (
                    <div className="mb-4 rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                        {error instanceof Error ? error.message : "Failed to load history"}
                    </div>
                )}

                <HistoryList
                    history={displayHistory}
                    timeZone={timeZone}
                    isEditing={isEditing}
                    onToggleEdit={setIsEditing}

                />
            </div>

            {/* Scroll-to-top */}
            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Back to top"
                className={clsx(
                    // Raised above the dock on mobile; desktop keeps the old offset.
                    "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-[calc(2rem+env(safe-area-inset-bottom))] right-6 z-50 p-3 rounded-full bg-slate-900/95 border border-white/10 text-white/70 shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-white/10 hover:text-white active:scale-95",
                    showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                )}
            >
                <ArrowUp className="w-5 h-5" />
            </button>

        </div>
    );
}

export default function HistoryClient({ timeZone }: { timeZone: string }) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 px-4 sm:px-6 main-safe-top mx-auto max-w-[1600px]">
                    <SkeletonRows count={8} rowClassName="h-16 rounded-2xl" />
                </div>
            }
        >
            <HistoryContent timeZone={timeZone} />
        </Suspense>
    )
}
