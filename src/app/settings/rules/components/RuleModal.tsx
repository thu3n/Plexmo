import { useState, useEffect } from "react";
import { X, Save, ShieldAlert, Users, Server, AlertTriangle, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import useSWR from "swr";

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
        exclude_same_ip?: boolean;
        schedule?: {
            type: 'block' | 'allow';
            timeWindows: Array<{
                startTime: string;
                endTime: string;
                days: number[];
            }>;
            timezone?: string;
            graceMinutes?: number;
        };
    };
    discordWebhookId: string | null;
    discordWebhookIds?: string[];
    global?: boolean;
    userCount?: number;
    serverCount?: number;
    assignments?: { userIds: string[], serverIds: string[] };
}

interface Webhook {
    id: string;
    name: string;
}

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
    const { data: webhookData } = useSWR<{ webhooks: Webhook[] }>("/api/notifications/webhooks", fetcher);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">

            {showConfirmation && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl scale-in-center flex flex-col max-h-[80vh]">
                        <div className="flex items-center gap-3 mb-4 text-amber-500 shrink-0">
                            <AlertTriangle className="w-8 h-8" />
                            <h3 className="text-xl font-bold text-white">Confirm Rule Changes</h3>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-1 mb-6">
                            {/* Global Warning */}
                            {(!isEditing || (ruleUsers?.every((u: any) => !u.enabled) && ruleServers?.every((s: any) => !s.enabled))) && (
                                <div className="mb-6">
                                    <p className="text-white/80 leading-relaxed font-medium">
                                        You are creating a <span className="text-blue-400 font-bold">Global Rule</span>.
                                    </p>
                                    <p className="text-white/60 text-sm mt-1">
                                        Since no specific users or servers are selected, this rule will apply to <strong>EVERYONE</strong>.
                                    </p>
                                </div>
                            )}

                            {/* Impact Analysis */}
                            {impactData.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider">Impact Analysis</h4>
                                        <span className="text-xs font-mono bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20">
                                            {impactData.length} Users Affected
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/50">
                                        The following users will have a <strong>stricter limit</strong> applied by this rule:
                                    </p>
                                    <div className="bg-black/40 rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">
                                        {impactData.slice(0, 10).map((user, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 text-sm">
                                                <div className="font-medium text-white">{user.username}</div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-white/40">{user.oldLimit}</span>
                                                    <span className="text-white/20">→</span>
                                                    <span className="text-amber-500 font-bold">{user.newLimit}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {impactData.length > 10 && (
                                            <div className="p-2 text-center text-xs text-white/40 italic">
                                                ...and {impactData.length - 10} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                formData.type === 'max_concurrent_streams' ? (
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3 text-emerald-400">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                        <p className="text-sm font-medium">
                                            No existing user limits will be negatively impacted by this change.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-3 text-blue-400">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                        <p className="text-sm font-medium">
                                            This rule will automatically manage paused streams for all users.
                                        </p>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="flex gap-3 shrink-0">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitSave}
                                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition"
                            >
                                Confirm Save
                            </button>
                        </div>
                    </div>
                </div>
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
                                {/* Scheduled Access Settings - Show FIRST for scheduled_access type */}
                                {formData.type === "scheduled_access" ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">Schedule Type</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        settings: {
                                                            ...formData.settings,
                                                            schedule: { ...formData.settings.schedule!, type: 'block' }
                                                        }
                                                    })}
                                                    className={clsx(
                                                        "flex-1 py-2 px-4 rounded-lg border font-medium text-sm transition-all",
                                                        formData.settings.schedule?.type === 'block'
                                                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                                                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                                    )}
                                                >
                                                    Block During Hours
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        settings: {
                                                            ...formData.settings,
                                                            schedule: { ...formData.settings.schedule!, type: 'allow' }
                                                        }
                                                    })}
                                                    className={clsx(
                                                        "flex-1 py-2 px-4 rounded-lg border font-medium text-sm transition-all",
                                                        formData.settings.schedule?.type === 'allow'
                                                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                                                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                                    )}
                                                >
                                                    Allow Only During Hours
                                                </button>
                                            </div>
                                        </div>

                                        {/* Time Windows List */}
                                        <div className="space-y-4">
                                            {formData.settings.schedule?.timeWindows?.map((window, idx) => (
                                                <div key={idx} className="space-y-3 p-4 bg-black/20 rounded-lg border border-white/5 relative group">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                            newWindows.splice(idx, 1);
                                                            setFormData({
                                                                ...formData,
                                                                settings: {
                                                                    ...formData.settings,
                                                                    schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                                }
                                                            });
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Remove time window"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>

                                                    <div className="grid grid-cols-2 gap-3 pr-8">
                                                        <div>
                                                            <label className="block text-xs font-bold text-white/40 mb-1">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={window.startTime}
                                                                onChange={(e) => {
                                                                    const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                                    newWindows[idx] = { ...newWindows[idx], startTime: e.target.value };
                                                                    setFormData({
                                                                        ...formData,
                                                                        settings: {
                                                                            ...formData.settings,
                                                                            schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                                        }
                                                                    });
                                                                }}
                                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-white/40 mb-1">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={window.endTime}
                                                                onChange={(e) => {
                                                                    const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                                    newWindows[idx] = { ...newWindows[idx], endTime: e.target.value };
                                                                    setFormData({
                                                                        ...formData,
                                                                        settings: {
                                                                            ...formData.settings,
                                                                            schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                                        }
                                                                    });
                                                                }}
                                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-white/40 mb-2">Active Days</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {[
                                                                { label: 'Sun', value: 0 },
                                                                { label: 'Mon', value: 1 },
                                                                { label: 'Tue', value: 2 },
                                                                { label: 'Wed', value: 3 },
                                                                { label: 'Thu', value: 4 },
                                                                { label: 'Fri', value: 5 },
                                                                { label: 'Sat', value: 6 },
                                                            ].map((day) => {
                                                                const isSelected = window.days.includes(day.value);
                                                                return (
                                                                    <button
                                                                        key={day.value}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                                            const currentDays = [...newWindows[idx].days];
                                                                            if (isSelected) {
                                                                                newWindows[idx].days = currentDays.filter(d => d !== day.value);
                                                                            } else {
                                                                                newWindows[idx].days = [...currentDays, day.value].sort();
                                                                            }
                                                                            setFormData({
                                                                                ...formData,
                                                                                settings: {
                                                                                    ...formData.settings,
                                                                                    schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                                                }
                                                                            });
                                                                        }}
                                                                        className={clsx(
                                                                            "w-10 h-10 rounded-lg font-bold text-xs transition-all",
                                                                            isSelected
                                                                                ? "bg-purple-500 text-white shadow-lg"
                                                                                : "bg-white/5 text-white/40 hover:bg-white/10"
                                                                        )}
                                                                    >
                                                                        {day.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                    newWindows.push({
                                                        startTime: "22:00",
                                                        endTime: "07:00",
                                                        days: [0, 1, 2, 3, 4, 5, 6]
                                                    });
                                                    setFormData({
                                                        ...formData,
                                                        settings: {
                                                            ...formData.settings,
                                                            schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                        }
                                                    });
                                                }}
                                                className="w-full py-3 rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Time Window
                                            </button>
                                        </div>

                                        <div className="pt-4 border-t border-white/5">
                                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                                            <input
                                                value={formData.settings.message}
                                                onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:outline-none placeholder:text-white/20 text-sm"
                                                placeholder="Access blocked during scheduled hours. Try again later."
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                            <div>
                                                <div className="font-medium text-white text-sm">Enforce scheduled access restrictions</div>
                                                <div className="text-xs text-white/40 mt-0.5">Terminate streams when users access during blocked time windows</div>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.enforce ? "bg-amber-500" : "bg-white/10")}>
                                                    <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.enforce ? "translate-x-4" : "translate-x-0")} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={formData.settings.enforce} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, enforce: e.target.checked } })} />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    /* Regular enforcement settings for other rule types */
                                    <div className="space-y-4">
                                        {!formData.settings.enforce && (
                                            <div className="flex items-start gap-2 text-blue-400/80 text-xs bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                                                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                                <p>When enforcement is disabled, violations will only be logged. Streams will NOT be terminated.</p>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-white text-sm">
                                                    {formData.type === 'kill_paused_streams'
                                                        ? 'Kill streams when paused too long'
                                                        : 'Kill Stream when exceed limits'}
                                                </div>
                                                <div className="text-xs text-white/40 mt-0.5">
                                                    {formData.type === 'kill_paused_streams'
                                                        ? 'Automatically terminate streams exceeding pause limit'
                                                        : 'Automatically kill streams exceeding limit'}
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.enforce ? "bg-amber-500" : "bg-white/10")}>
                                                    <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.enforce ? "translate-x-4" : "translate-x-0")} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={formData.settings.enforce} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, enforce: e.target.checked } })} />
                                            </label>
                                        </div>

                                        {formData.type === "max_concurrent_streams" && (
                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div>
                                                    <div className="font-medium text-white text-sm">Exclude Same IP</div>
                                                    <div className="text-xs text-white/40 mt-0.5">Allow multiple streams from the same public IP (e.g. same household) without penalty</div>
                                                </div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.exclude_same_ip ? "bg-emerald-500" : "bg-white/10")}>
                                                        <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.exclude_same_ip ? "translate-x-4" : "translate-x-0")} />
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={!!formData.settings.exclude_same_ip} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, exclude_same_ip: e.target.checked } })} />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formData.settings.enforce && formData.type === "max_concurrent_streams" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-white text-sm">Kill All Streams</div>
                                                <div className="text-xs text-white/40 mt-0.5">Kill ALL user streams on violation instead of just the newest</div>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.kill_all ? "bg-red-500" : "bg-white/10")}>
                                                    <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.kill_all ? "translate-x-4" : "translate-x-0")} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={formData.settings.kill_all} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, kill_all: e.target.checked } })} />
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                                            <input
                                                value={formData.settings.message}
                                                onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20 text-sm"
                                                placeholder="Stream Limit Exceeded"
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {formData.settings.enforce && formData.type === "kill_paused_streams" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 border-t border-white/5">
                                        <div>
                                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                                            <input
                                                value={formData.settings.message}
                                                onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20 text-sm"
                                                placeholder="Stream paused for too long"
                                            />
                                            <p className="text-xs text-white/40 mt-1.5">
                                                You can use <code className="px-1.5 py-0.5 bg-white/10 rounded text-amber-400">$time</code> to show the configured pause duration (e.g. "3 minuter")
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Scheduled Access Settings */}

                            </div>
                        </form>
                    )}

                    {activeTab === "notifications" && (
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3 text-blue-400">
                                <div className="mt-0.5">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Notification Channels</p>
                                    <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                        Select where alerts should be sent when this rule is triggered.
                                        You can configure multiple destinations.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {webhooks && webhooks.length > 0 ? (
                                    webhooks.map(w => {
                                        const isSelected = formData.discordWebhookIds?.includes(w.id) || (formData.discordWebhookId === w.id);
                                        return (
                                            <div
                                                key={w.id}
                                                className={clsx(
                                                    "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                                    isSelected
                                                        ? "bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]"
                                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                        isSelected ? "bg-amber-500 text-slate-900" : "bg-white/10 text-white/40"
                                                    )}>
                                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className={clsx("font-bold text-sm", isSelected ? "text-amber-500" : "text-white")}>
                                                            {w.name}
                                                        </div>
                                                        <div className="text-xs text-white/40">Discord Webhook</div>
                                                    </div>
                                                </div>

                                                <label className="flex items-center cursor-pointer relative">
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={!!isSelected}
                                                        onChange={e => {
                                                            const current = formData.discordWebhookIds || (formData.discordWebhookId ? [formData.discordWebhookId!] : []) || [];
                                                            let next;
                                                            if (e.target.checked) {
                                                                next = [...current, w.id];
                                                            } else {
                                                                next = current.filter(id => id !== w.id);
                                                            }
                                                            // Remove dupes
                                                            next = [...new Set(next)];
                                                            setFormData({ ...formData, discordWebhookIds: next, discordWebhookId: null });
                                                        }}
                                                    />
                                                    <div className={clsx(
                                                        "w-10 h-6 rounded-full transition-colors relative shrink-0",
                                                        isSelected ? "bg-amber-500" : "bg-white/10"
                                                    )}>
                                                        <div className={clsx(
                                                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                                            isSelected ? "translate-x-4" : "translate-x-0"
                                                        )} />
                                                    </div>
                                                </label>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/20">
                                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419z" />
                                            </svg>
                                        </div>
                                        <p className="text-white font-medium mb-1">No Webhooks Configured</p>
                                        <p className="text-white/40 text-xs mb-4">Set up a Discord webhook to receive notifications.</p>
                                        <a
                                            href="/settings/notifications"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-bold hover:bg-amber-400 transition"
                                        >
                                            Configure Webhooks
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "users" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                <button
                                    onClick={() => setActiveScopeTab("users")}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                        activeScopeTab === "users" ? "bg-amber-500 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    Specific Users
                                </button>
                                <button
                                    onClick={() => setActiveScopeTab("servers")}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                        activeScopeTab === "servers" ? "bg-amber-500 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    Entire Servers
                                </button>
                            </div>

                            {activeScopeTab === "servers" && (
                                <div className="space-y-2">
                                    {ruleServers?.map((server: any) => (
                                        <div key={server.serverId} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                            <span className="text-sm font-medium text-white">{server.name}</span>
                                            <label className="flex items-center cursor-pointer relative">
                                                <input
                                                    type="checkbox"
                                                    checked={server.enabled}
                                                    onChange={(e) => toggleRuleServer(server.serverId, e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-amber-500/80 transition-all duration-200"></div>
                                                <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-all duration-200 peer-checked:translate-x-full shadow-sm"></div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeScopeTab === "users" && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search users..."
                                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                        {ruleUsers?.filter((u: any) => u.username.toLowerCase().includes(search.toLowerCase())).map((user: any) => (
                                            <div key={user.userId} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-white truncate">{user.username}</div>
                                                    <div className="text-xs text-white/40 truncate">{user.email || user.serverNames}</div>
                                                </div>
                                                <label className="flex items-center cursor-pointer relative ml-4 shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={user.enabled}
                                                        onChange={(e) => toggleRuleUser(user.userId, e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-500/80 transition-all duration-200"></div>
                                                    <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-all duration-200 peer-checked:translate-x-full shadow-sm"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
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
