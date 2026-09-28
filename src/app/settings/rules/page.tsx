"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import RuleList from "@/features/rules/components/settings/RuleList";
import RuleModal from "@/features/rules/components/settings/RuleModal";
import RuleTypeSelectionModal from "@/features/rules/components/settings/RuleTypeSelectionModal";
import RuleDebugger from "@/features/rules/components/settings/RuleDebugger";
import RuleEventsModal from "@/features/rules/components/settings/RuleEventsModal";
import SegmentedTabs, { tabId, tabPanelId } from "@/features/rules/components/settings/ui/SegmentedTabs";
import { useRuleManagement, type PersistedRule } from "@/features/rules/hooks/useRuleManagement";

type RulesView = "list" | "debug";

const VIEW_TABS = [
    { value: "list" as const, label: "Rules List" },
    { value: "debug" as const, label: "Debugger" },
];

const TABS_ID = "rules-view";

export default function RulesPage() {
    const { t } = useLanguage();
    const { rules, isLoading, error, retry, editorTarget, isTypeSelectionOpen, actions } = useRuleManagement();
    const [activeTab, setActiveTab] = useState<RulesView>("list");
    const [historyRule, setHistoryRule] = useState<PersistedRule | null>(null);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SettingsSection title={t("rules.pageTitle")} description={t("rules.pageDesc")}>
                <SegmentedTabs
                    tabs={VIEW_TABS}
                    value={activeTab}
                    onChange={setActiveTab}
                    label="Rules view"
                    idBase={TABS_ID}
                    className="w-fit"
                />

                <div role="tabpanel" id={tabPanelId(TABS_ID, activeTab)} aria-labelledby={tabId(TABS_ID, activeTab)}>
                    {activeTab === "list" ? (
                        <RuleList
                            rules={rules}
                            isLoading={isLoading}
                            error={error}
                            onRetry={retry}
                            onCreate={actions.openCreateModal}
                            onEdit={actions.openEditModal}
                            onDelete={actions.deleteRule}
                            onToggle={actions.toggleRule}
                            onDuplicate={actions.duplicateRule}
                            onShowHistory={setHistoryRule}
                        />
                    ) : (
                        <RuleDebugger />
                    )}
                </div>
            </SettingsSection>

            <RuleTypeSelectionModal
                isOpen={isTypeSelectionOpen}
                onClose={actions.closeModals}
                onSelect={actions.selectRuleType}
            />

            {editorTarget && <RuleModal target={editorTarget} onClose={actions.closeModals} onSave={actions.saveRule} />}

            <RuleEventsModal rule={historyRule} onClose={() => setHistoryRule(null)} />
        </div>
    );
}
