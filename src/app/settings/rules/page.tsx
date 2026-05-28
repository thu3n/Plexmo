"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/components/LanguageContext";
import RuleCard from "@/features/rules/components/settings/RuleCard";
import RuleModal from "@/features/rules/components/settings/RuleModal";
import RuleTypeSelectionModal from "@/features/rules/components/settings/RuleTypeSelectionModal";
import RuleDebugger from "@/features/rules/components/settings/RuleDebugger";
import { useRuleManagement } from "@/features/rules/hooks/useRuleManagement";

export default function RulesPage() {
    const { t } = useLanguage();
    const {
        rules,
        selectedRule,
        isModalOpen,
        isTypeSelectionOpen,
        actions
    } = useRuleManagement();

    const [activeTab, setActiveTab] = useState<"list" | "debug">("list");

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
                                onEdit={actions.openEditModal}
                                onDelete={actions.deleteRule}
                                onToggle={actions.toggleRule}
                            />
                        </div>
                    ))}

                    {/* Add Rule Card */}
                    <button
                        onClick={actions.openCreateModal}
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
                onClose={actions.closeModals}
                onSelect={actions.selectRuleType}
            />

            <RuleModal
                rule={selectedRule}
                isOpen={isModalOpen}
                onClose={actions.closeModals}
                onSave={actions.saveRule}
            />
        </div>
    );
}
