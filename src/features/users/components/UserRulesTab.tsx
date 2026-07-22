"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useLanguage } from "@/components/LanguageContext";
import { RuleHistoryModal } from "@/features/rules/components/RuleHistoryModal";
import type { PersistedRuleInstance } from "@/lib/rules/types";

type ServerRuleState = Record<string, { enabled: boolean; servers: Array<{ serverId: string; name: string }> }>;

export function UserRulesTab({ username }: { username: string }) {
    const { t } = useLanguage();
    const [allRules, setAllRules] = useState<PersistedRuleInstance[]>([]);
    const [userRules, setUserRules] = useState<string[]>([]);
    const [serverRules, setServerRules] = useState<ServerRuleState>({});
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
                                        {(rule.enabled ? t("rules.globalActive", { value: String(rule.settings.limit) }) : t("rules.globalInactive"))}
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
