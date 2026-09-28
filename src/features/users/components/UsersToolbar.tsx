"use client";

import { Search, ArrowDownWideNarrow, ArrowUpNarrowWide, RefreshCw, X } from "lucide-react";
import { SORT_KEYS, type SortKey } from "../lib/directory-query";
import type { UsersDirectoryState } from "../hooks/useUsersDirectory";

type Props = Pick<
    UsersDirectoryState,
    "servers" | "filters" | "sort" | "setSearch" | "changeServer" | "setSort" | "syncFromPlex" | "isSyncing"
>;

const CONTROL =
    "bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500 focus:outline-none focus:bg-black/20 transition-all";

export function UsersToolbar({ servers, filters, sort, setSearch, changeServer, setSort, syncFromPlex, isSyncing }: Props) {
    const sortLabel = SORT_KEYS.find((s) => s.key === sort.key)?.label ?? "";
    const ascending = sort.dir === "asc";
    const DirIcon = ascending ? ArrowUpNarrowWide : ArrowDownWideNarrow;

    return (
        <>
            {/* Search */}
            <div className="flex-1 relative">
                <label htmlFor="users-search" className="sr-only">Search users</label>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" aria-hidden />
                <input
                    id="users-search"
                    type="search"
                    placeholder="Search users..."
                    value={filters.search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full pl-10 pr-10 py-3 placeholder:text-white/20 [&::-webkit-search-cancel-button]:hidden ${CONTROL}`}
                />
                {filters.search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Filter Server (membership filter) */}
            <select
                aria-label="Filter by server"
                value={filters.serverId}
                onChange={(e) => changeServer(e.target.value)}
                className={`px-4 py-3 [&>option]:bg-slate-900 ${CONTROL}`}
            >
                <option value="">All Servers</option>
                {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>

            {/* Sort: field + direction */}
            <div className="flex gap-2">
                <select
                    aria-label="Sort by"
                    value={sort.key}
                    onChange={(e) => setSort({ ...sort, key: e.target.value as SortKey })}
                    className={`flex-1 md:flex-none px-4 py-3 [&>option]:bg-slate-900 ${CONTROL}`}
                >
                    {SORT_KEYS.map((s) => (
                        <option key={s.key} value={s.key}>Sort: {s.label}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setSort({ ...sort, dir: ascending ? "desc" : "asc" })}
                    aria-label={`Sorted by ${sortLabel}, ${ascending ? "ascending" : "descending"}. Switch to ${ascending ? "descending" : "ascending"}`}
                    title={ascending ? "Ascending" : "Descending"}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <DirIcon className="w-5 h-5" />
                </button>
            </div>

            <button
                type="button"
                onClick={syncFromPlex}
                disabled={isSyncing}
                title="Fetch the current user list from every connected Plex server"
                className="px-6 py-3 rounded-xl bg-indigo-500 font-bold text-white hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <RefreshCw className={isSyncing ? "w-5 h-5 animate-spin" : "w-5 h-5"} aria-hidden />
                {isSyncing ? "Syncing..." : "Sync from Plex"}
            </button>
        </>
    );
}
