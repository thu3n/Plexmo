import { useEffect } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/Modal";
import type { RuleInstance } from "@/features/rules/types";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import { useRuleForm } from "@/features/rules/hooks/useRuleForm";
import type { RuleEditorTarget } from "@/features/rules/hooks/useRuleManagement";
import { tabForError, type RuleFieldError, type RuleFormTab } from "@/features/rules/utils/ruleValidation";
import ConfigTab, { ruleFieldId } from "./rule-forms/ConfigTab";
import NotificationsTab from "./rule-forms/NotificationsTab";
import ScopeTab from "./rule-forms/ScopeTab";
import SaveConfirmationDialog from "./rule-forms/SaveConfirmationDialog";
import SegmentedTabs, { tabId, tabPanelId } from "./ui/SegmentedTabs";

interface RuleModalProps {
    target: RuleEditorTarget;
    onClose: () => void;
    /** Rejects on failure; the modal then stays open with the input intact. */
    onSave: (rule: RuleInstance) => Promise<void>;
}

const TABS_ID = "rule-editor";

const TAB_LABELS: { value: RuleFormTab; label: string }[] = [
    { value: "config", label: "Configuration" },
    { value: "notifications", label: "Notifications" },
    { value: "users", label: "Scope" },
];

/**
 * Mounted only while a rule is being edited, so every open starts from fresh
 * state — no reset-on-prop-change bookkeeping.
 */
export default function RuleModal({ target, onClose, onSave }: RuleModalProps) {
    const form = useRuleForm(target, onSave);
    const { data: webhookData } = useSWR<{ webhooks: { id: string; name: string }[] }>(
        "/api/notifications/webhooks",
        fetchJsonOrThrow
    );

    // After a failed save switches tabs, focus the offending field once it renders.
    const { focusRequest } = form;
    useEffect(() => {
        if (!focusRequest) return;
        document.getElementById(ruleFieldId(focusRequest.field))?.focus();
    }, [focusRequest]);

    const errorFields = Object.keys(form.errors) as RuleFieldError[];
    const tabs = TAB_LABELS.map((t) => ({ ...t, hasError: errorFields.some((f) => tabForError(f) === t.value) }));

    return (
        <>
            <Modal
                isOpen
                onClose={onClose}
                dismissible={!form.isBusy && !form.showConfirmation}
                title={form.isEditing ? "Edit Rule" : "Create Rule"}
                size="xl"
                className="!pb-0"
            >
                <SegmentedTabs
                    tabs={tabs}
                    value={form.activeTab}
                    onChange={form.setActiveTab}
                    label="Rule settings"
                    idBase={TABS_ID}
                    className="max-w-lg mb-6"
                    tabClassName="flex-1 py-1.5"
                />

                <div role="tabpanel" id={tabPanelId(TABS_ID, form.activeTab)} aria-labelledby={tabId(TABS_ID, form.activeTab)}>
                    {form.activeTab === "config" && (
                        <ConfigTab
                            formData={form.formData}
                            setFormData={form.setFormData}
                            limitInput={form.limitInput}
                            setLimitInput={form.setLimitInput}
                            errors={form.errors}
                            onSubmit={form.requestSave}
                        />
                    )}
                    {form.activeTab === "notifications" && (
                        <NotificationsTab webhooks={webhookData?.webhooks} formData={form.formData} setFormData={form.setFormData} />
                    )}
                    {form.activeTab === "users" && (
                        <ScopeTab
                            users={form.scope.users}
                            servers={form.scope.servers}
                            error={form.scope.error}
                            isGlobal={form.isGlobalScope}
                            toggleUser={form.scope.toggleUser}
                            toggleServer={form.scope.toggleServer}
                        />
                    )}
                </div>

                <div className="sticky bottom-0 -mx-6 sm:-mx-8 mt-6 px-6 sm:px-8 py-6 border-t border-white/5 bg-slate-900 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={form.isBusy}
                        className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={form.requestSave}
                        disabled={form.isBusy}
                        className="flex-[2] py-3.5 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 shadow-lg shadow-amber-500/20"
                    >
                        {form.isAnalyzing
                            ? "Checking impact..."
                            : form.isSubmitting
                              ? "Saving..."
                              : form.isEditing
                                ? "Save Changes"
                                : "Create Rule"}
                    </button>
                </div>
            </Modal>

            <SaveConfirmationDialog
                isOpen={form.showConfirmation}
                isSubmitting={form.isSubmitting}
                isGlobalScope={form.isGlobalScope}
                ruleType={form.formData.type}
                impactData={form.impactData}
                onCancel={form.cancelConfirmation}
                onConfirm={form.submitSave}
            />
        </>
    );
}
