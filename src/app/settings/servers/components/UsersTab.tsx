"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Search, ArrowUpDown, UserPlus, UserCheck, Shield } from "lucide-react";
import type { PlexUser } from "@/lib/plex";
import type { PublicServer } from "@/lib/servers";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export function UsersTab() {
    const { t } = useLanguage();
    const { data: usersData, mutate: mutateUsers, isLoading } = useSWR<{ users: (PlexUser & { isImported?: boolean; isAdmin?: boolean })[] }>("/api/users", fetchJson);
    const { data: serversData } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson);

    const [searchQuery, setSearchQuery] = useState("");
    const [filterServerId, setFilterServerId] = useState("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [isImporting, setIsImporting] = useState(false);

    const filteredUsers = usersData?.users.filter(user => {
        if (filterServerId) {
            const server = serversData?.servers.find(s => s.id === filterServerId);
            if (server && user.serverName !== server.name) return false;
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return user.title?.toLowerCase().includes(q) || user.username?.toLowerCase().includes(q);
        }
        return true;
    }).sort((a, b) => {
        const diff = a.title.localeCompare(b.title);
        return sortOrder === "asc" ? diff : -diff;
    }) ?? [];

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
                <div className="flex flex-col md:flex-row gap-4 mb-8">
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

                    {/* Filter Server */}
                    <select
                        value={filterServerId}
                        onChange={(e) => setFilterServerId(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none focus:bg-black/20 transition-all [&>option]:bg-slate-900"
                    >
                        <option value="">All Servers</option>
                        {serversData?.servers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    {/* Sort */}
                    <button
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
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

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {isLoading ? (
                        [1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />)
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user, idx) => (
                            <Link
                                key={`${user.id}-${idx}`}
                                href={`/settings/users/${encodeURIComponent(user.username)}?returnTo=servers`}
                                className="block"
                            >
                                <SettingsCard className="h-full hover:border-amber-500/50 transition-colors group/card">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 shrink-0 rounded-full bg-slate-800 overflow-hidden ring-2 ring-white/10 group-hover/card:ring-amber-500/50 transition-all">
                                            {user.thumb ? (
                                                <img src={user.thumb} alt={user.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center font-bold text-white/30 text-lg">
                                                    {user.title.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-white truncate group-hover/card:text-amber-400 transition-colors">{user.title}</h4>
                                                {user.isImported && <UserCheck className="w-4 h-4 text-emerald-400" />}
                                                {user.isAdmin && <Shield className="w-3 h-3 text-amber-500" />}
                                            </div>
                                            <p className="text-xs text-white/40 truncate">{user.serverName}</p>
                                        </div>
                                    </div>
                                </SettingsCard>
                            </Link>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center text-white/50">
                            No users found.
                        </div>
                    )}
                </div>
            </SettingsSection>
        </div>
    );
}
