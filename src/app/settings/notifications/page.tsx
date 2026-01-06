"use client";

import { useState } from "react";
import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Bell, Plus, Trash2, Edit2, X, Play, Square, XCircle } from "lucide-react";
import clsx from "clsx";

type DiscordWebhook = {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export default function NotificationsSettingsPage() {
    const { t } = useLanguage();
    const { data, isLoading, mutate } = useSWR<{ webhooks: DiscordWebhook[] }>("/api/notifications/webhooks", fetchJson);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<DiscordWebhook | null>(null);

    const handleEdit = (webhook: DiscordWebhook) => {
        setEditingWebhook(webhook);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingWebhook(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete webhook "${name}"?`)) return;
        try {
            await fetch(`/api/notifications/webhooks/${id}`, { method: "DELETE" });
            mutate();
        } catch (e) {
            alert("Failed to delete webhook");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SettingsSection
                title="Notifications"
                description="Configure how you want to be notified about events."
            >
                {isLoading ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5 border border-white/5" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {data?.webhooks.map((webhook) => (
                            <WebhookCard
                                key={webhook.id}
                                webhook={webhook}
                                onEdit={() => handleEdit(webhook)}
                                onDelete={() => handleDelete(webhook.id, webhook.name)}
                            />
                        ))}

                        {/* Add Webhook Card */}
                        <button
                            onClick={handleAdd}
                            className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                        >
                            <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                Add Webhook
                            </span>
                        </button>
                    </div>
                )}
            </SettingsSection>

            {isModalOpen && (
                <WebhookModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    webhook={editingWebhook}
                    onSuccess={() => mutate()}
                />
            )}
        </div>
    );
}

function WebhookCard({ webhook, onEdit, onDelete }: { webhook: DiscordWebhook, onEdit: () => void, onDelete: () => void }) {
    const eventCount = webhook.events.length;

    return (
        <SettingsCard className="group relative flex flex-col justify-between min-h-[200px]">
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-2xl bg-[#5865F2]/10 text-[#5865F2]">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onEdit} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={onDelete} className="p-2 hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-300">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{webhook.name}</h3>
                <p className="text-xs text-white/40 truncate font-mono">{webhook.url}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={clsx("w-2 h-2 rounded-full shadow-[0_0_10px]", webhook.enabled ? "bg-emerald-500 shadow-emerald-500/50" : "bg-white/20 shadow-none")} />
                    <span className={clsx("text-xs font-bold uppercase tracking-wider", webhook.enabled ? "text-emerald-500" : "text-white/40")}>
                        {webhook.enabled ? "Active" : "Disabled"}
                    </span>
                </div>
                <div className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md">
                    {eventCount} Events
                </div>
            </div>
        </SettingsCard>
    );
}

function WebhookModal({ isOpen, onClose, webhook, onSuccess }: { isOpen: boolean, onClose: () => void, webhook: DiscordWebhook | null, onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        name: webhook?.name || "",
        url: webhook?.url || "",
        events: webhook?.events || ["start", "stop", "terminate"],
        enabled: webhook?.enabled ?? true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const toggleEvent = (event: string) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter(e => e !== event)
                : [...prev.events, event]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const method = webhook ? "PUT" : "POST";
            const url = webhook ? `/api/notifications/webhooks/${webhook.id}` : "/api/notifications/webhooks";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Failed");
            onSuccess();
            onClose();
        } catch {
            alert("Error saving webhook");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const res = await fetch("/api/notifications/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUrl: formData.url })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Test failed");
            }
            setTestResult({ success: true, message: "Test notification sent!" });
        } catch (e: any) {
            setTestResult({ success: false, message: e.message || "Failed to send test." });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white z-10 bg-slate-900/50 backdrop-blur-md">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 pr-8">
                    {webhook ? "Edit Webhook" : "Add Webhook"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Name</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20"
                            placeholder="My Discord Server"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Webhook URL</label>
                        <input
                            type="url"
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none font-mono text-sm placeholder:text-white/20"
                            placeholder="https://discord.com/api/webhooks/..."
                            required
                        />
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">Events</label>
                        <div className="grid gap-2">
                            <button type="button" onClick={() => toggleEvent("start")} className={clsx("flex items-center gap-3 p-3 rounded-xl border transition-all text-left", formData.events.includes("start") ? "bg-amber-500/10 border-amber-500 text-white" : "bg-white/5 border-transparent text-white/50 hover:bg-white/10")}>
                                <div className={clsx("p-1.5 rounded-lg shrink-0", formData.events.includes("start") ? "bg-amber-500 text-slate-900" : "bg-white/10")}>
                                    <Play className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm">Stream Start</span>
                            </button>
                            <button type="button" onClick={() => toggleEvent("stop")} className={clsx("flex items-center gap-3 p-3 rounded-xl border transition-all text-left", formData.events.includes("stop") ? "bg-amber-500/10 border-amber-500 text-white" : "bg-white/5 border-transparent text-white/50 hover:bg-white/10")}>
                                <div className={clsx("p-1.5 rounded-lg shrink-0", formData.events.includes("stop") ? "bg-amber-500 text-slate-900" : "bg-white/10")}>
                                    <Square className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm">Stream Stop</span>
                            </button>
                            <button type="button" onClick={() => toggleEvent("terminate")} className={clsx("flex items-center gap-3 p-3 rounded-xl border transition-all text-left", formData.events.includes("terminate") ? "bg-amber-500/10 border-amber-500 text-white" : "bg-white/5 border-transparent text-white/50 hover:bg-white/10")}>
                                <div className={clsx("p-1.5 rounded-lg shrink-0", formData.events.includes("terminate") ? "bg-amber-500 text-slate-900" : "bg-white/10")}>
                                    <XCircle className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm">Stream Terminated</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-white/5 mt-4 gap-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.enabled ? "bg-emerald-500" : "bg-white/10")}>
                                <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.enabled ? "translate-x-4" : "translate-x-0")} />
                            </div>
                            <span className="text-sm font-bold text-white">Enable Webhook</span>
                            <input type="checkbox" className="hidden" checked={formData.enabled} onChange={e => setFormData({ ...formData, enabled: e.target.checked })} />
                        </label>

                        <div className="flex items-center gap-4 self-end sm:self-auto">
                            <button type="button" onClick={handleTest} disabled={isTesting || !formData.url} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                                {isTesting ? "Testing..." : "Test"}
                            </button>
                            {testResult && (
                                <span className={clsx("text-sm font-bold", testResult.success ? "text-emerald-400" : "text-rose-400")}>{testResult.message}</span>
                            )}
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 mt-4 shadow-lg shadow-amber-500/20">
                        {isSubmitting ? "Saving..." : "Save Webhook"}
                    </button>
                </form>
            </div>
        </div>
    );
}
