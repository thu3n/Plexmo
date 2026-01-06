"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import useSWR from "swr";
import clsx from "clsx";
import { useLanguage } from "../../../components/LanguageContext";
import RuleCard from "./components/RuleCard";
import RuleModal from "./components/RuleModal";
import RuleTypeSelectionModal from "./components/RuleTypeSelectionModal";
import RuleDebugger from "./components/RuleDebugger";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RuleInstance {
    id?: string;
    type: string;
    name: string;
    enabled: boolean;
    settings: {
        limit: number;
        enforce: boolean;
        kill_all: boolean;
        message: string;
        notify?: boolean;
    };
    discordWebhookId: string | null;
    discordWebhookIds?: string[];
    global?: boolean;
    userCount?: number;
    serverCount?: number;
}

export default function RulesPage() {
    const { t } = useLanguage();
    const { data: rules, error, mutate } = useSWR<RuleInstance[]>("/api/rules/instances", fetcher);
    const [selectedRule, setSelectedRule] = useState<RuleInstance | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"list" | "debug">("list");

    const handleCreateClick = () => {
        setIsTypeSelectionOpen(true);
    };

    const handleTypeSelect = (type: string) => {
        setIsTypeSelectionOpen(false);
        // Initialize new rule with selected type
        setSelectedRule({
            type,
            name: "",
            enabled: true,
            settings: {
                limit: 1,
                enforce: false,
                kill_all: false,
                message: ""
            },
            discordWebhookId: null,
            discordWebhookIds: []
        });
        setIsModalOpen(true);
    };

    const handleEdit = (rule: RuleInstance) => {
        setSelectedRule(rule);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            await fetch(`/api/rules/instances/${id}`, { method: "DELETE" });
            mutate();
        } catch (error) {
            console.error("Failed to delete rule", error);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        // Optimistic update
        mutate(
            rules?.map(r => r.id === id ? { ...r, enabled } : r),
            false
        );

        try {
            // We need to fetch the current rule first to update it fully via PUT, 
            // OR use a specific PATCH endpoint if we had one. 
            // Re-using PUT requires sending full object.
            // But we have the object in 'rules'.
            const rule = rules?.find(r => r.id === id);
            if (rule) {
                await fetch(`/api/rules/instances/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...rule, enabled }),
                });
                mutate();
            }
        } catch (error) {
            console.error("Failed to toggle rule", error);
            mutate(); // Revert
        }
    };

    const handleSave = async (rule: RuleInstance) => {
        try {
            if (rule.id) {
                // Update
                await fetch(`/api/rules/instances/${rule.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rule),
                });
            } else {
                // Create
                await fetch("/api/rules/instances", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rule),
                });
            }
            mutate();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save rule", error);
            throw error;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        {t("rules.pageTitle")}
                    </h1>
                    <p className="text-white/40 mt-2">
                        {t("rules.pageDesc")}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab("list")}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                            activeTab === "list" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        Rules List
                    </button>
                    <button
                        onClick={() => setActiveTab("debug")}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                            activeTab === "debug" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        )}
                    >
                        Debugger
                    </button>
                </div>
            </div>

            {activeTab === "list" ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Rule Cards */}
                    {rules?.map((rule) => (
                        <div key={rule.id} className="h-full">
                            <RuleCard
                                rule={rule as any}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                            />
                        </div>
                    ))}

                    {/* Add Rule Card */}
                    <button
                        onClick={handleCreateClick}
                        className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                    >
                        <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                            <Plus className="w-8 h-8" />
                        </div>
                        <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                            Add New Rule
                        </span>
                    </button>
                </div>
            ) : (
                <RuleDebugger />
            )}

            <RuleTypeSelectionModal
                isOpen={isTypeSelectionOpen}
                onClose={() => setIsTypeSelectionOpen(false)}
                onSelect={handleTypeSelect}
            />

            <RuleModal
                rule={selectedRule}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}
