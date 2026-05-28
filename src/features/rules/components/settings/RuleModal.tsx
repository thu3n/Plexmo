import { useState, useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import useSWR from "swr";
import type { RuleInstance } from "@/features/rules/types";
import ScheduledAccessForm from "./rule-forms/ScheduledAccessForm";
import EnforcementForm from "./rule-forms/EnforcementForm";
import NotificationsTab from "./rule-forms/NotificationsTab";
import ScopeTab from "./rule-forms/ScopeTab";
import SaveConfirmationDialog from "./rule-forms/SaveConfirmationDialog";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RuleModalProps {
    rule?: RuleInstance;
    isOpen: boolean;
    onClose: () => void;
    onSave: (rule: RuleInstance) => Promise<void>;
}

export default function RuleModal({ rule, isOpen, onClose, onSave }: RuleModalProps) {
    const isEditing = !!rule?.id;

    // Helper to get default settings based on type
    const getDefaultSettings = (type: string) => {
        const base = {
            limit: 1,
            enforce: false,
            kill_all: false,
            message: "",
            notify: true,
            exclude_same_ip: false
        };

        if (type === "scheduled_access") {
            return {
                ...base,
                schedule: {
                    type: 'block' as const,
                    timeWindows: [{
                        startTime: "22:00",
                        endTime: "07:00",
                        days: [1, 2, 3, 4, 5] // Weekdays
                    }]
                }
            };
        }

        return base;
    };

    const [formData, setFormData] = useState<RuleInstance>(rule || {
        type: "max_concurrent_streams",
        name: "",
        enabled: true,
        settings: getDefaultSettings("max_concurrent_streams"),
        discordWebhookId: null
    });

    // Manage assignments for EXISTING rules here or keep simple config first?
    // User requested "inside every rule you can specify own rules and own discord".
    // AND assignments.
    // If Creating New Rule: We can't assign users until it's created (no ID).
    // So we might need to save first then show assignments, OR handle assignments in a separate step/tab AFTER creation?
    // Let's allow configuration first. Assignments can be done by editing?
    // User said: "In inside every rule you can specify own rules and own discord".
    // I will include configuration here.
    // assignments might be complex to squeeze into same form if not created yet.
    // I suggest: Create rule -> then Edit to add users. OR:
    // If editing, show users tab. If creating, hide users tab until saved?
    // Let's try to show config first.

    const [activeTab, setActiveTab] = useState<"config" | "notifications" | "users">("config");
    const [activeScopeTab, setActiveScopeTab] = useState<"servers" | "users">("users");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // External Data
    const { data: webhookData } = useSWR<{ webhooks: { id: string; name: string }[] }>("/api/notifications/webhooks", fetcher);
    const webhooks = webhookData?.webhooks;
    // Only fetch users/servers if editing. If creating, fetch "new" to get empty lists.
    const { data: ruleUsers, mutate: mutateUsers } = useSWR(isEditing ? `/api/rules/instances/${rule?.id}/users` : "/api/rules/instances/new/users", fetcher);
    const { data: ruleServers, mutate: mutateServers } = useSWR(isEditing ? `/api/rules/instances/${rule?.id}/servers` : "/api/rules/instances/new/servers", fetcher);

    // Local state for new rule assignments
    const [pendingAssignments, setPendingAssignments] = useState({
        userIds: new Set<string>(),
        serverIds: new Set<string>()
    });

    const [search, setSearch] = useState("");

    useEffect(() => {
        if (rule) {
            setFormData(rule);
            setPendingAssignments({ userIds: new Set(), serverIds: new Set() });
        } else {
            // Reset for new - use the helper to get proper default settings
            setFormData({
                type: formData.type || "max_concurrent_streams",
                name: "",
                enabled: true,
                settings: getDefaultSettings(formData.type || "max_concurrent_streams"),
                discordWebhookId: null
            });
            setPendingAssignments({ userIds: new Set(), serverIds: new Set() });
            setActiveTab("config");
        }
    }, [rule, isOpen]);

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [impactData, setImpactData] = useState<{ username: string, oldLimit: any, newLimit: any }[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const performAnalysis = async (isGlobal: boolean): Promise<any[]> => {
        setIsAnalyzing(true);
        try {
            // Unify assignments for analysis
            let assignments = { userIds: [] as string[], serverIds: [] as string[] };

            if (isEditing) {
                assignments = {
                    userIds: ruleUsers?.filter((u: any) => u.enabled).map((u: any) => u.userId) || [],
                    serverIds: ruleServers?.filter((s: any) => s.enabled).map((s: any) => s.serverId) || []
                };
            } else {
                assignments = {
                    userIds: Array.from(pendingAssignments.userIds),
                    serverIds: Array.from(pendingAssignments.serverIds)
                };
            }

            const res = await fetch("/api/rules/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rule: formData,
                    assignments
                })
            });
            const data = await res.json();
            return data.impactedUsers || [];
        } catch (error) {
            console.error("Analysis failed", error);
            return [];
        } finally {
            setIsAnalyzing(false);
        }
    };

    const submitSave = async () => {
        setIsSubmitting(true);
        try {
            const ruleToSave: RuleInstance = {
                ...formData,
                assignments: !isEditing ? {
                    userIds: Array.from(pendingAssignments.userIds),
                    serverIds: Array.from(pendingAssignments.serverIds)
                } : undefined
            };

            await onSave(ruleToSave);
            onClose();
        } catch (error) {
            console.error("Failed to save rule", error);
        } finally {
            setIsSubmitting(false);
            setShowConfirmation(false);
        }
    };

    const handleSaveRequest = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!formData.name.trim()) {
            // Should probably show an error state but for now just return
            return;
        }

        let isGlobalScope = !isEditing; // Default assumption

        // Check if actually has assignments
        if (isEditing) {
            const hasEnabledUsers = ruleUsers?.some((u: any) => u.enabled);
            const hasEnabledServers = ruleServers?.some((s: any) => s.enabled);
            if (!hasEnabledUsers && !hasEnabledServers) isGlobalScope = true;
            else isGlobalScope = false;
        } else {
            // Creating
            if (pendingAssignments.userIds.size === 0 && pendingAssignments.serverIds.size === 0) {
                isGlobalScope = true;
            } else {
                isGlobalScope = false;
            }
        }

        const impacted = await performAnalysis(isGlobalScope);
        setImpactData(impacted);

        if (isGlobalScope || impacted.length > 0) {
            setShowConfirmation(true);
        } else {
            submitSave();
        }
    };

    const toggleRuleUser = async (userId: string, enabled: boolean) => {
        if (isEditing) {
            if (!rule?.id) return;
            try {
                await fetch(`/api/rules/instances/${rule.id}/users`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, enabled }),
                });
                mutateUsers();
            } catch (e) {
                console.error(e);
            }
        } else {
            // Local state update
            const next = new Set(pendingAssignments.userIds);
            if (enabled) next.add(userId);
            else next.delete(userId);
            setPendingAssignments({ ...pendingAssignments, userIds: next });

            // Optimistic update for UI list
            mutateUsers(
                ruleUsers?.map((u: any) => u.userId === userId ? { ...u, enabled } : u),
                false
            );
        }
    };

    const toggleRuleServer = async (serverId: string, enabled: boolean) => {
        if (isEditing) {
            if (!rule?.id) return;
            try {
                await fetch(`/api/rules/instances/${rule.id}/servers`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ serverId, enabled }),
                });
                mutateServers();
            } catch (e) {
                console.error(e);
            }
        } else {
            // Local state
            const next = new Set(pendingAssignments.serverIds);
            if (enabled) next.add(serverId);
            else next.delete(serverId);
            setPendingAssignments({ ...pendingAssignments, serverIds: next });

            mutateServers(
                ruleServers?.map((s: any) => s.serverId === serverId ? { ...s, enabled } : s),
                false
            );
        }
    };

    if (!isOpen) return null;

    // Whether the confirmation dialog should show the "global rule" warning.
    // Matches the original inline condition exactly.
    const confirmIsGlobalScope = !isEditing
        || (ruleUsers?.every((u: any) => !u.enabled) && ruleServers?.every((s: any) => !s.enabled));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">

            {showConfirmation && (
                <SaveConfirmationDialog
                    isGlobalScope={confirmIsGlobalScope}
                    ruleType={formData.type}
                    impactData={impactData}
                    onCancel={() => setShowConfirmation(false)}
                    onConfirm={submitSave}
                />
            )}
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl relative max-h-[90vh] flex flex-col">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white z-10 bg-slate-900/50 backdrop-blur-md">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 sm:p-8 border-b border-white/5 shrink-0">
                    <h2 className="text-2xl font-bold text-white">
                        {isEditing ? "Edit Rule" : "Create Rule"}
                    </h2>

                    {/* Tabs - Always visible */}
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl mt-6 max-w-lg">
                        <button
                            onClick={() => setActiveTab("config")}
                            className={clsx(
                                "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                                activeTab === "config" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                            )}
                        >
                            Configuration
                        </button>
                        <button
                            onClick={() => setActiveTab("notifications")}
                            className={clsx(
                                "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                                activeTab === "notifications" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                            )}
                        >
                            Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab("users")}
                            className={clsx(
                                "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                                activeTab === "users" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                            )}
                        >
                            Scope
                        </button>
                    </div>
                </div>

                <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === "config" && (
                        <form id="rule-form" onSubmit={handleSaveRequest} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Rule Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20"
                                    placeholder={formData.type === 'scheduled_access' ? 'e.g. Kids Bedtime' : formData.type === 'kill_paused_streams' ? 'e.g. Auto-Kill Paused Streams' : 'e.g. Gold Tier Limit'}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                                    {formData.type === "kill_paused_streams"
                                        ? "Time Limit (Minutes)"
                                        : formData.type === "scheduled_access"
                                            ? "Schedule Configuration"
                                            : "Stream Limit"}
                                </label>
                                {formData.type !== "scheduled_access" && (
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.settings.limit}
                                        onChange={e => setFormData({ ...formData, settings: { ...formData.settings, limit: parseInt(e.target.value) || 1 } })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                                    />
                                )}
                                {formData.type === "kill_paused_streams" && (
                                    <p className="text-xs text-white/40 mt-1">Sessions paused for longer than this will be terminated.</p>
                                )}
                                {formData.type === "scheduled_access" && (
                                    <p className="text-xs text-white/40 mt-1">Configure time windows when access should be blocked or allowed below.</p>
                                )}
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
                                {formData.type === "scheduled_access" ? (
                                    <ScheduledAccessForm formData={formData} setFormData={setFormData} />
                                ) : (
                                    <EnforcementForm formData={formData} setFormData={setFormData} />
                                )}
                            </div>
                        </form>
                    )}

                    {activeTab === "notifications" && (
                        <NotificationsTab webhooks={webhooks} formData={formData} setFormData={setFormData} />
                    )}

                    {activeTab === "users" && (
                        <ScopeTab
                            activeScopeTab={activeScopeTab}
                            setActiveScopeTab={setActiveScopeTab}
                            ruleServers={ruleServers}
                            ruleUsers={ruleUsers}
                            search={search}
                            setSearch={setSearch}
                            toggleRuleServer={toggleRuleServer}
                            toggleRuleUser={toggleRuleUser}
                        />
                    )}
                </div>

                <div className="p-6 sm:p-8 border-t border-white/5 shrink-0">
                    <button
                        type="button"
                        onClick={handleSaveRequest}
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 shadow-lg shadow-amber-500/20"
                    >
                        {isSubmitting ? "Saving..." : (isEditing ? "Save Changes" : "Create Rule")}
                    </button>
                </div>
            </div>
        </div>
    );
}
