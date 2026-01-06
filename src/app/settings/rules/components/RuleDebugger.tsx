"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, Loader2, User, Server, Globe, AlertTriangle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DebugResult {
    rule: {
        id: string;
        name: string;
        type: string;
        enabled: boolean;
        settings: {
            limit: number;
        };
    };
    applies: boolean;
    reasons: {
        global: boolean;
        user: boolean;
        servers: string[];
    };
}

export default function RuleDebugger() {
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<{ id: string, username: string, serverName?: string } | null>(null);
    const [debugResults, setDebugResults] = useState<DebugResult[] | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch users for search dropdown
    // We can use the same endpoint as RuleModal or a general users endpoint
    // Assuming /api/users exists or similar?
    // Let's use the one from RuleModal: /api/rules/instances/new/users
    // It returns all users.
    const { data: usersData } = useSWR("/api/rules/instances/new/users", fetcher);

    const handleSelectUser = async (user: any) => {
        setSelectedUser(user);
        setSearch("");
        setLoading(true);
        try {
            const res = await fetch("/api/rules/debug", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.userId }) // user.userId from the modal api
            });
            const data = await res.json();
            setDebugResults(data);
        } catch (error) {
            console.error("Failed to debug user", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = usersData?.filter((u: any) =>
        u.username.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5); // Limit results

    // Calculate Effective Limit (Strictest Wins - Min Limit)
    // Only count ENABLED rules that APPLY
    const activeRules = debugResults?.filter(r => r.applies && r.rule.enabled) || [];
    const limits = activeRules
        .filter(r => r.rule.type === "max_concurrent_streams")
        .map(r => r.rule.settings.limit);

    const effectiveLimit = limits.length > 0 ? Math.min(...limits) : "Unlimited";

    return (
        <div className="space-y-6">
            {/* Search Section */}
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5 text-amber-500" />
                    Find User
                </h3>
                <div className="relative max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            value={selectedUser ? selectedUser.username : search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setSelectedUser(null);
                                setDebugResults(null);
                            }}
                            placeholder="Search user to debug..."
                            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20"
                        />
                        {selectedUser && (
                            <button
                                onClick={() => { setSelectedUser(null); setSearch(""); setDebugResults(null); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Dropdown */}
                    {search && !selectedUser && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                            {filteredUsers?.map((u: any) => (
                                <button
                                    key={u.userId}
                                    onClick={() => handleSelectUser(u)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center justify-between group"
                                >
                                    <div>
                                        <div className="font-medium text-white group-hover:text-amber-500 transition-colors">{u.username}</div>
                                        <div className="text-xs text-white/40">{u.serverNames}</div>
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-white/0 group-hover:text-amber-500 transition-colors" />
                                </button>
                            ))}
                            {filteredUsers?.length === 0 && (
                                <div className="p-4 text-center text-white/40 text-sm">No users found</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Section */}
            {selectedUser && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loading ? (
                        <div className="p-12 flex flex-col items-center justify-center text-white/40">
                            <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
                            <p>Analyzing rules...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6 rounded-2xl flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">Effective Stream Limit</div>
                                    <div className="text-3xl font-bold text-white leading-none">
                                        {effectiveLimit}
                                        {effectiveLimit !== "Unlimited" && <span className="text-lg text-white/40 font-normal ml-2">streams</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-white/60">Active Rules</div>
                                    <div className="text-2xl font-bold text-white">{activeRules.length}</div>
                                </div>
                            </div>

                            {/* Rules List */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider pl-1">All Rules Analysis</h3>
                                {debugResults && debugResults.length > 0 ? (
                                    debugResults.map((item, idx) => {
                                        const isApplied = item.applies && item.rule.enabled;
                                        // Determine if this is the "Effective" rule
                                        // It is effective if:
                                        // 1. It is applied
                                        // 2. Its limit matches the effectiveLimit (Strictest Wins)
                                        const ruleLimit = item.rule.settings.limit;
                                        const isEffective = isApplied && ruleLimit === effectiveLimit;
                                        const isOverridden = isApplied && ruleLimit > (effectiveLimit as number);

                                        return (
                                            <div key={idx} className={clsx(
                                                "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all",
                                                isEffective
                                                    ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_var(--tw-shadow-color)] shadow-emerald-500/10"
                                                    : isOverridden
                                                        ? "bg-orange-500/5 border-orange-500/10 opacity-80"
                                                        : "bg-white/5 border-white/5 opacity-50"
                                            )}>
                                                <div className="mb-3 sm:mb-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={clsx("font-bold", isEffective ? "text-white" : "text-white/60")}>
                                                            {item.rule.name}
                                                        </span>
                                                        {!item.rule.enabled && <span className="text-xs bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded">Disabled Rule</span>}

                                                        {/* Status Badges */}
                                                        {isEffective && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold shadow-sm shadow-emerald-900/20">Active Limit</span>}
                                                        {isOverridden && <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded">Overridden</span>}
                                                        {!isApplied && item.rule.enabled && <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded">Scope Mismatch</span>}
                                                    </div>
                                                    <div className={clsx("text-sm mt-1", isEffective ? "text-white/60" : "text-white/30")}>
                                                        Limit: <strong className={isEffective ? "text-emerald-400" : "text-white/40"}>{item.rule.settings.limit}</strong> streams
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isApplied ? (
                                                        <>
                                                            {item.reasons.global && (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold uppercase">
                                                                    <Globe className="w-3 h-3" />
                                                                    Global
                                                                </span>
                                                            )}
                                                            {item.reasons.user && (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase">
                                                                    <User className="w-3 h-3" />
                                                                    Assigned
                                                                </span>
                                                            )}
                                                            {item.reasons.servers.length > 0 && (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold uppercase">
                                                                    <Server className="w-3 h-3" />
                                                                    Server
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs font-medium text-white/20 uppercase tracking-wider px-2">
                                                            Not Applied
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-white/40">
                                        No rules found in system.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
