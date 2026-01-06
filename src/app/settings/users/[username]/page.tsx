"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { UserStats } from "@/lib/user_stats";
import type { HistoryEntry } from "@/lib/history";
import { HistoryModal } from "@/components/HistoryModal";
import { useLanguage } from "@/components/LanguageContext";
import { formatDate } from "@/lib/format";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch stats");
    return response.json();
};

const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ""}`;
};

const StatCard = ({ title, count, duration, color }: { title: string; count: number; duration: number; color: string }) => (
    <div className={`relative overflow-hidden rounded-2xl bg-${color}-500/10 p-6 border border-${color}-500/20`}>
        <div className={`absolute top-0 right-0 p-4 opacity-10`}>
            {/* Background Icon/Graphic could go here */}
            <svg className={`h-24 w-24 text-${color}-500`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
        </div>
        <h3 className="text-sm font-medium text-white/60 mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{count}</span>
            <span className="text-sm text-white/40">plays</span>
        </div>
        <div className={`mt-2 inline-flex items-center rounded-lg bg-${color}-500/20 px-2.5 py-1 text-sm font-medium text-${color}-300`}>
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDuration(duration)}
        </div>
    </div>
);

const getPlayerIconInfo = (player: string | undefined, platform: string | undefined): { icon: string, color: string } => {
    const p = (player || platform || "").toLowerCase();

    const platformMap: Record<string, string> = {
        "android": "android",
        "ios": "ios",
        "apple": "ios",
        "iphone": "ios",
        "ipad": "ios",
        "tvos": "atv",
        "chrome": "chrome",
        "firefox": "firefox",
        "edge": "msedge",
        "safari": "safari",
        "lg": "lg",
        "webos": "lg",
        "samsung": "samsung",
        "tizen": "samsung",
        "roku": "roku",
        "playstation": "playstation",
        "ps4": "playstation",
        "ps5": "playstation",
        "xbox": "xbox",
        "wiiu": "wiiu",
        "kodi": "kodi",
        "plexamp": "plexamp",
        "linux": "linux",
        "macos": "macos",
        "osx": "macos",
        "windows": "windows",
        "opera": "opera",
        "ie": "ie",
        "dlna": "dlna",
        "chromecast": "chromecast",
        "alexa": "alexa",
        "tivo": "tivo"
    };

    const platformColors: Record<string, string> = {
        "alexa": "#00caff",
        "android": "#3ddc84",
        "atv": "#a2aaad",
        "chrome": "#db4437",
        "chromecast": "#4285f4",
        "default": "#e5a00d",
        "dlna": "#4ba32f",
        "firefox": "#ff7139",
        "gtv": "#008bcf",
        "ie": "#18bcef",
        "ios": "#a2aaad",
        "kodi": "#30aada",
        "lg": "#990033",
        "linux": "#0099cc",
        "macos": "#a2aaad",
        "msedge": "#0078d7",
        "opera": "#fa1e4e",
        "playstation": "#003087",
        "plex": "#e5a00d",
        "plexamp": "#e5a00d",
        "roku": "#673293",
        "safari": "#00d3f9",
        "samsung": "#034ea2",
        "synclounge": "#151924",
        "tivo": "#00a7e1",
        "wiiu": "#03a9f4",
        "windows": "#0078d7",
        "wp": "#68217a",
        "xbmc": "#3b4872",
        "xbox": "#107c10"
    };

    let icon = "plex";
    let color = "#e5a00d";

    for (const [key, value] of Object.entries(platformMap)) {
        if (p.includes(key)) {
            icon = value;
            if (platformColors[icon]) {
                color = platformColors[icon];
            }
            break;
        }
    }
    return { icon, color };
};

const PlatformIcon = ({ name, count }: { name: string, count: number }) => {
    const { icon, color } = getPlayerIconInfo(name, name);
    return (
        <div className="flex flex-col items-center gap-2 min-w-[80px] p-2 rounded-xl hover:bg-white/5 transition-colors cursor-default">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
            >
                <img
                    src={`/images/platforms/${icon}.svg`}
                    alt={name}
                    className="h-8 w-8 invert brightness-0"
                />
            </div>
            <div className="text-center w-full">
                <span className="block text-xs font-semibold text-white/90 truncate w-full" title={name}>{name || "Unknown"}</span>
                <span className="block text-[10px] font-medium text-white/50">{count} plays</span>
            </div>
        </div>
    );
};





import { useSearchParams } from "next/navigation";

export default function UserStatsPage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = use(params);
    const decodedUsername = decodeURIComponent(username);
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const fromDashboard = searchParams.get("from") === "dashboard";
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [activeTab, setActiveTab] = useState<"stats" | "rules">("stats");

    // Construct back link with query params
    const returnTo = searchParams.get("returnTo");
    const backLink = fromDashboard ? "/" : (returnTo === "servers" ? "/settings/servers?tab=users" : returnTo === "rules" ? "/settings/rules" : "/settings/users");

    const { data: stats, isLoading, error } = useSWR<UserStats>(
        username ? `/api/stats/user?username=${encodeURIComponent(decodedUsername)}` : null,
        fetchJson
    );

    if (error) return <div className="p-8 text-rose-400">Error loading stats.</div>;
    if (isLoading) return <div className="p-8 text-white/50">Loading stats...</div>;
    if (!stats) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
            <main className="mx-auto max-w-6xl px-6 py-12">
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
                            <img
                                src={`https://ui-avatars.com/api/?name=${decodedUsername}&background=random&color=fff&size=128`}
                                alt={decodedUsername}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{decodedUsername}</h1>
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

                {activeTab === "stats" && (
                    <div className="space-y-12">
                        {/* Global Stats Grid */}
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                            <StatCard title="Last 24 Hours" count={stats.global.last24h.count} duration={stats.global.last24h.duration} color="emerald" />
                            <StatCard title="Last 7 Days" count={stats.global.last7d.count} duration={stats.global.last7d.duration} color="cyan" />
                            <StatCard title="Last 30 Days" count={stats.global.last30d.count} duration={stats.global.last30d.duration} color="indigo" />
                            <StatCard title="All Time" count={stats.global.allTime.count} duration={stats.global.allTime.duration} color="amber" />
                        </div>

                        {/* Streak Banner */}
                        <div className="mb-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 p-6 flex items-center justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="text-9xl">🔥</span>
                            </div>

                            <div className="flex gap-12 relative z-10">
                                <div>
                                    <h3 className="text-sm font-medium text-orange-200/60 uppercase tracking-wider mb-1">Current Streak</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-orange-500">{stats.streaks?.current || 0}</span>
                                        <span className="text-sm font-bold text-orange-400">days</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-orange-200/60 uppercase tracking-wider mb-1">Longest Streak</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-orange-500/50">{stats.streaks?.longest || 0}</span>
                                        <span className="text-sm font-bold text-orange-400/50">days</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right max-w-md hidden sm:block relative z-10">
                                <p className="text-orange-200/80 text-sm italic">
                                    "Watch at least 10 minutes of content daily to keep your streak alive!"
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-8 lg:grid-cols-3">
                            {/* Platform & Player Usage */}
                            <div className="lg:col-span-1 min-w-0">
                                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl h-full flex flex-col justify-between">
                                    {/* Platforms - Top 50% */}
                                    <div className="flex-1 pb-6 overflow-hidden">
                                        <h2 className="mb-4 text-xl font-bold text-white">Platform Usage</h2>
                                        <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar mask-linear-fade w-full">
                                            {stats.platforms.map((p, i) => (
                                                <PlatformIcon key={`${p.platform}-${i}`} name={p.platform} count={p.count} />
                                            ))}
                                            {stats.platforms.length === 0 && (
                                                <p className="text-white/30 text-sm">No platform data available.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Divider with dots */}
                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-white/10" />
                                        </div>
                                    </div>

                                    {/* Players - Bottom 50% */}
                                    <div className="flex-1 pt-6 overflow-hidden">
                                        <h2 className="mb-4 text-xl font-bold text-white">Player Usage</h2>
                                        <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar mask-linear-fade w-full">
                                            {stats.players?.map((p, i) => (
                                                <PlatformIcon key={`${p.player}-${i}`} name={p.player} count={p.count} />
                                            ))}
                                            {(!stats.players || stats.players.length === 0) && (
                                                <p className="text-white/30 text-sm">No player data available.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recently Played */}
                            <div className="lg:col-span-2 min-w-0">
                                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                                    <h2 className="mb-6 text-xl font-bold text-white">Recently Played</h2>
                                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar mask-linear-fade w-full">
                                        {stats.recentlyPlayed.map((entry, i) => (
                                            <div
                                                key={`${entry.id}-${i}`}
                                                className="group relative aspect-[2/3] min-w-[160px] w-[160px] overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all hover:scale-105 hover:ring-amber-500/50 hover:shadow-lg hover:shadow-black/50 shrink-0 flex flex-col cursor-pointer"
                                                onClick={() => setSelectedEntry(entry)}
                                            >
                                                {/* Poster Image */}
                                                <div className="relative flex-1 overflow-hidden">
                                                    {(entry.thumb || entry.parentThumb) ? (
                                                        <img
                                                            src={`/api/image?path=${encodeURIComponent(entry.parentThumb || entry.thumb || "")}&serverId=${entry.serverId}`}
                                                            alt={entry.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-slate-800">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src="/images/Plexmo_icon.png"
                                                                alt="No Poster"
                                                                className="h-12 w-12 object-contain opacity-20 grayscale"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Diagonal Ribbon for Date */}
                                                    <div className="absolute top-[16px] -right-[28px] w-[100px] rotate-45 bg-amber-500 py-[2px] text-center text-[9px] font-bold text-black shadow-sm z-10">
                                                        {formatDate(entry.stopTime)}
                                                    </div>
                                                </div>

                                                {/* Simplified Footer Content */}
                                                <div className="bg-black/80 backdrop-blur-md p-3 border-t border-white/10 shrink-0 h-[50px] flex flex-col justify-center">
                                                    <h3 className="line-clamp-1 text-xs font-bold text-white leading-tight mb-0.5" title={entry.title}>
                                                        {entry.title}
                                                    </h3>
                                                    {entry.subtitle && (
                                                        <p className="line-clamp-1 text-[10px] text-white/60 font-medium" title={entry.subtitle}>
                                                            {entry.subtitle}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {stats.recentlyPlayed.length === 0 && (
                                            <div className="w-full flex h-40 items-center justify-center text-white/30">
                                                No history yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "rules" && (
                    <UserRulesTab username={decodedUsername} />
                )}
            </main>

            {selectedEntry && (
                <HistoryModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
}

import { RuleHistoryModal } from "@/components/RuleHistoryModal";

// ... existing imports

function UserRulesTab({ username }: { username: string }) {
    const { t } = useLanguage();
    const [allRules, setAllRules] = useState<any[]>([]);
    const [userRules, setUserRules] = useState<string[]>([]);
    const [serverRules, setServerRules] = useState<Record<string, { enabled: boolean, servers: Array<{ serverId: string, name: string }> }>>({});
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRule, setSelectedRule] = useState<string | null>(null);

    const { data: history } = useSWR<{ id: number, ruleKey: string, triggeredAt: string, endedAt?: string, details: string }[]>(
        `/api/users/${encodeURIComponent(username)}/rules/history`,
        async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    );

    useEffect(() => {
        const load = async () => {
            try {
                const [rulesRes, userRes] = await Promise.all([
                    fetch("/api/rules/instances"),
                    fetch(`/api/users/${encodeURIComponent(username)}/rules`)
                ]);

                if (rulesRes.ok) {
                    setAllRules(await rulesRes.json());
                }
                if (userRes.ok) {
                    const data = await userRes.json();
                    setUserRules(data.rules || []);
                    setServerRules(data.serverRules || {});
                    setUserId(data.userId);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [username]);

    const toggleRule = async (ruleKey: string, enabled: boolean) => {
        if (!userId) return;

        // Optimistic update
        setUserRules(prev => enabled ? [...prev, ruleKey] : prev.filter(k => k !== ruleKey));

        try {
            await fetch(`/api/rules/${ruleKey}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, enabled })
            });
        } catch (e) {
            console.error(e);
            // Revert
            setUserRules(prev => enabled ? prev.filter(k => k !== ruleKey) : [...prev, ruleKey]);
        }
    };

    if (loading) return <div className="text-white/50">Loading rules...</div>;
    if (!userId) return <div className="text-rose-400">User not found in local database.</div>;

    const filteredHistory = history?.filter(h => h.ruleKey === selectedRule) || [];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">{t("settings.rules")}</h2>
            <div className="grid gap-4">
                {allRules.map(rule => {
                    const isEnabled = userRules.includes(rule.id);
                    const serverEnforcement = serverRules[rule.id];
                    const hasServerEnforcement = serverEnforcement?.enabled || false;
                    const hasGlobalEnforcement = rule.global && rule.enabled;
                    const isAnyEnforcement = isEnabled || hasServerEnforcement || hasGlobalEnforcement;
                    const isDisabledByEnforcement = hasServerEnforcement || hasGlobalEnforcement;

                    return (
                        <div key={rule.id} className={`p-4 rounded-xl border transition-colors ${isAnyEnforcement ? "bg-amber-500/10 border-amber-500/50" : "bg-white/5 border-white/10"} hover:bg-white/10 group`}>
                            <div className="flex items-center justify-between">
                                <Link href="/settings/rules" className="flex-1 min-w-0">
                                    <h3 className={`font-medium ${isAnyEnforcement ? "text-amber-400" : "text-white"} group-hover:text-amber-300 transition-colors`}>
                                        {rule.type === "max_concurrent_streams" ? t("rules.maxConcurrent") : rule.name}
                                    </h3>
                                    <p className="text-sm text-white/50 mt-1">
                                        {(rule.enabled ? t("rules.globalActive", { value: rule.settings.limit }) : t("rules.globalInactive"))}
                                    </p>
                                </Link>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedRule(rule.id)}
                                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                        title={t("rules.viewHistory")}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                        </svg>
                                    </button>
                                    {hasServerEnforcement && (
                                        <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                            {t("rules.serverEnforced") || "Enforced by Server"}
                                        </span>
                                    )}
                                    {hasGlobalEnforcement && !hasServerEnforcement && (
                                        <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                            Global Rule
                                        </span>
                                    )}
                                    <label
                                        className={`relative inline-flex items-center ${isDisabledByEnforcement ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isEnabled || isDisabledByEnforcement}
                                            onChange={(e) => !isDisabledByEnforcement && toggleRule(rule.id, e.target.checked)}
                                            disabled={isDisabledByEnforcement}
                                        />
                                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {allRules.length === 0 && (
                    <p className="text-white/30">{t("rules.noRules")}</p>
                )}
            </div>

            <RuleHistoryModal
                isOpen={!!selectedRule}
                onClose={() => setSelectedRule(null)}
                ruleName={allRules.find(r => r.id === selectedRule)?.name || selectedRule || ""}
                history={filteredHistory}
            />
        </div>
    );
}
// fixed keys
