"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { HistoryList } from "@/components/HistoryList";
import Link from "next/link";
import type { HistoryEntry } from "@/lib/history";
import { Suspense, useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { ArrowLeft, Search, Filter, Trash2, Edit2, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import clsx from "clsx";



const fetchJson = (url: string) => fetch(url).then((res) => res.json());

// API Response type
type HistoryApiResponse = {
    history: HistoryEntry[];
    activeSessions: HistoryEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
};

// Available page sizes
const PAGE_SIZES = [25, 50, 100, 250];

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
    const [pageSize, setPageSize] = useState(25);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

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
    const { data, isLoading } = useSWR<HistoryApiResponse>(
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
        <div className="flex min-h-screen bg-slate-950 text-white selection:bg-amber-500/30 font-sans">
            {/* Ambient Background - reusing the effect from SettingsLayout */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-3xl opacity-40 mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40rem] h-[40rem] bg-amber-500/5 rounded-full blur-3xl opacity-40 mix-blend-screen" />
            </div>

            <div className="flex-1 flex flex-col min-w-0 relative z-10 max-w-7xl mx-auto w-full p-4 md:p-8 lg:p-12">

                {/* Header */}
                <div className="flex flex-col gap-8 mb-12">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-white tracking-tight">{t("history.title")}</h1>
                                <p className="text-white/50">{t("history.recentActivity")}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
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
                                    className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear All
                                </button>
                            )}
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={clsx(
                                    "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border",
                                    isEditing
                                        ? "bg-amber-500 text-slate-900 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                        : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                {isEditing ? t("common.cancel") : t("common.edit")}
                            </button>
                            <UserMenu />
                        </div>
                    </div>
                </div>

                {/* Filters & Controls */}
                <div className="sticky top-6 z-40 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-950/80 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl transition-all duration-300 mb-8">
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
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

                    <div className="h-px bg-white/10 w-full lg:w-px lg:h-8" />

                    {/* Pagination */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none [&>option]:bg-slate-900"
                        >
                            {PAGE_SIZES.map(size => (
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

                <HistoryList
                    history={displayHistory}
                    timeZone={timeZone}
                    isEditing={isEditing}
                    onToggleEdit={setIsEditing}

                />
            </div>


        </div>
    );
}

export default function HistoryClient({ timeZone }: { timeZone: string }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/50">Loading...</div>}>
            <HistoryContent timeZone={timeZone} />
        </Suspense>
    )
}
