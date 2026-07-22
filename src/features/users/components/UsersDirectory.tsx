"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { SkeletonRows } from "@/components/Skeleton";
import { Search, ArrowUpDown, UserPlus } from "lucide-react";
import { useScrolled } from "@/lib/use-scrolled";
import type { PublicServer } from "@/lib/servers";
import type { DirectoryUserRow } from "../types";
import { groupUsers } from "../lib/groupUsers";
import { useUsersServerFilter } from "../lib/server-filter";
import { UserCard } from "./UserCard";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

/**
 * Canonical user directory: one card per identity (accountId) with server
 * memberships as badges. Import still posts the raw per-server rows — the
 * dedup is display-only.
 */
export function UsersDirectory() {
    const { t } = useLanguage();
    const { data: usersData, mutate: mutateUsers, isLoading } = useSWR<{ users: DirectoryUserRow[] }>("/api/users", fetchJson);
    const { data: serversData } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson);

    const [searchQuery, setSearchQuery] = useState("");
    const [storedServerId, setFilterServerId] = useUsersServerFilter();
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [isImporting, setIsImporting] = useState(false);
    const scrolled = useScrolled();

    // A persisted id whose server has since been removed falls back to "All
    // Servers" instead of silently filtering every user out.
    const filterServerId =
        serversData && !serversData.servers.some((s) => s.id === storedServerId)
            ? ""
            : storedServerId;

    const users = useMemo(() => groupUsers(usersData?.users ?? []), [usersData?.users]);

    const filteredUsers = users
        .filter((user) => {
            if (filterServerId && !user.servers.some((s) => s.serverId === filterServerId)) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return user.title.toLowerCase().includes(q) || user.username.toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            const diff = a.title.localeCompare(b.title);
            return sortOrder === "asc" ? diff : -diff;
        });

    const handleImportAll = async () => {
        if (!usersData?.users.length || isImporting) return;
        setIsImporting(true);
        try {
            await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ users: usersData.users }),
            });
            await mutateUsers();
            alert(t("settings.importSuccess"));
        } catch {
            alert(t("settings.importError"));
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.users")}
                description={t("settings.usersDesc")}
            >
                {/* Sticky on md+ only — the stacked mobile controls would eat
                    too much viewport under the settings header. */}
                <div
                    className={`flex flex-col md:flex-row gap-4 mb-8 md:sticky md:top-6 md:z-40 md:rounded-3xl md:transition-all md:duration-300 md:p-4 md:-mx-4 md:-mt-4 md:mb-4 ${scrolled ? "md:bg-slate-950/95 md:shadow-2xl" : ""
                        }`}
                >
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-amber-500 focus:outline-none focus:bg-black/20 transition-all placeholder:text-white/20"
                        />
                    </div>

                    {/* Filter Server (membership filter) */}
                    <select
                        value={filterServerId}
                        onChange={(e) => setFilterServerId(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none focus:bg-black/20 transition-all [&>option]:bg-slate-900"
                    >
                        <option value="">All Servers</option>
                        {serversData?.servers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    {/* Sort */}
                    <button
                        onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <ArrowUpDown className="w-5 h-5" />
                    </button>

                    {/* Import Action */}
                    <button
                        onClick={handleImportAll}
                        disabled={isImporting || !usersData?.users.length}
                        className="px-6 py-3 rounded-xl bg-indigo-500 font-bold text-white hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                        {isImporting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" /> : <UserPlus className="w-5 h-5" />}
                        {t("settings.importAll")}
                    </button>
                </div>

                {isLoading ? (
                    <SkeletonRows count={4} rowClassName="h-24 rounded-2xl" />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => <UserCard key={user.accountId} user={user} />)
                        ) : (
                            <div className="col-span-full py-12 text-center text-white/50">
                                No users found.
                            </div>
                        )}
                    </div>
                )}
            </SettingsSection>
        </div>
    );
}
