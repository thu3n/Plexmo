"use client";

import { useState } from "react";
import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import type { PublicServer } from "@/lib/servers";
import clsx from "clsx";
import { flattenResources } from "@/lib/plex-utils";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export function ServersTab() {
    const { t } = useLanguage();
    const { data, isLoading, mutate } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<PublicServer | null>(null);

    const handleEdit = (server: PublicServer) => {
        setEditingServer(server);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingServer(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`${t("settings.confirmDelete")} ${name}?`)) return;
        try {
            await fetch(`/api/servers/${id}`, { method: "DELETE" });
            mutate();
        } catch (e) {
            alert("Failed to delete server");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.servers")}
                description="Connect and manage your Plex Media Servers."
            >
                {isLoading ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5 border border-white/5" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {data?.servers.map((server) => (
                            <SettingsCard key={server.id} className="group relative flex flex-col justify-between min-h-[200px]">
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 rounded-2xl bg-white/5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={server.color || "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(server)} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(server.id, server.name)} className="p-2 hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-300">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">{server.name}</h3>
                                    <p className="text-xs text-white/40 truncate font-mono">{server.baseUrl}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Connected</span>
                                </div>
                            </SettingsCard>
                        ))}

                        {/* Add Server Card */}
                        <button
                            onClick={handleAdd}
                            className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                        >
                            <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                {t("settings.addServer")}
                            </span>
                        </button>
                    </div>
                )}
            </SettingsSection>

            {/* Server Modal - Integrated here for simplicity */}
            {isModalOpen && (
                <ServerModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    server={editingServer}
                    onSuccess={() => mutate()}
                />
            )}
        </div>
    );
}

function ServerModal({ isOpen, onClose, server, onSuccess }: { isOpen: boolean, onClose: () => void, server: PublicServer | null, onSuccess: () => void }) {
    const { t } = useLanguage();
    const [discoveryMode, setDiscoveryMode] = useState<"auto" | "manual">(server ? "manual" : "auto");
    const [formData, setFormData] = useState({
        name: server?.name || "",
        baseUrl: server?.baseUrl || "",
        token: server?.maskedToken || "",
        color: server?.color || ""
    });

    // Auth & Discovery State
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [discoveryToken, setDiscoveryToken] = useState("");
    const [fetchedServers, setFetchedServers] = useState<any[]>([]);

    // Test
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handlePlexSignIn = async () => {
        setIsAuthenticating(true);
        try {
            const res = await fetch("/api/auth/plex");
            if (!res.ok) throw new Error("Failed init");
            const { id, authUrl, clientIdentifier } = await res.json();

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            const popup = window.open(authUrl, "PlexAuth", `width=${width},height=${height},left=${left},top=${top}`);

            const poll = setInterval(async () => {
                if (popup?.closed) { clearInterval(poll); setIsAuthenticating(false); return; }
                try {
                    const check = await fetch("/api/auth/plex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinId: id, clientIdentifier, mode: "discovery" }) });
                    if (check.ok) {
                        clearInterval(poll);
                        popup?.close();
                        const data = await check.json();
                        setDiscoveryToken(data.token);
                        fetchPlexResources(data.token);
                    }
                } catch { }
            }, 2000);
        } catch { setIsAuthenticating(false); }
    };

    const fetchPlexResources = async (token?: string) => {
        const t = token || discoveryToken;
        if (!t) return;
        try {
            const res = await fetch("/api/plex/resources", { headers: { "X-Plex-Token": t } });
            const data = await res.json();
            setFetchedServers(data.servers || []);
        } finally { }
    };

    const flatConnections = flattenResources(fetchedServers);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const method = server ? "PUT" : "POST";
            const url = server ? `/api/servers/${server.id}` : "/api/servers";

            const payload: any = { ...formData };
            if (payload.token.includes("…") && server) {
                delete payload.token;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed");
            onSuccess();
            onClose();
        } catch {
            alert("Error saving");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await fetch("/api/servers/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: formData.baseUrl, token: formData.token })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setTestResult({ success: true, message: "Connection successful" });
        } catch (e: any) {
            setTestResult({ success: false, message: e.message || "Failed" });
        } finally { setIsTesting(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6">{server ? t("common.edit") : t("settings.addServer")}</h2>

                {!server && (
                    <div className="flex bg-black/40 p-1 rounded-xl mb-6">
                        <button onClick={() => setDiscoveryMode("auto")} className={clsx("flex-1 py-2 rounded-lg text-sm font-bold transition-all", discoveryMode === "auto" ? "bg-amber-500 text-slate-900" : "text-white/50 hover:text-white")}>Plex Account</button>
                        <button onClick={() => setDiscoveryMode("manual")} className={clsx("flex-1 py-2 rounded-lg text-sm font-bold transition-all", discoveryMode === "manual" ? "bg-amber-500 text-slate-900" : "text-white/50 hover:text-white")}>Manual</button>
                    </div>
                )}

                {discoveryMode === "auto" && !server && !discoveryToken && (
                    <div className="text-center py-8">
                        <button onClick={handlePlexSignIn} disabled={isAuthenticating} className="w-full py-4 rounded-xl bg-[#e5a00d] font-bold text-white hover:bg-[#d4940c] transition disabled:opacity-50">
                            {isAuthenticating ? "Authenticating..." : "Sign In with Plex"}
                        </button>
                    </div>
                )}

                {discoveryMode === "auto" && !server && discoveryToken && (
                    <div className="mb-6 space-y-2">
                        <label className="text-sm font-bold text-white">Select Server</label>
                        <select
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white"
                            onChange={(e) => {
                                const s = flatConnections.find(c => c.id === e.target.value);
                                if (s) setFormData({ ...formData, name: s.name, baseUrl: s.uri, token: s.token });
                            }}
                        >
                            <option value="">Choose a server...</option>
                            {flatConnections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.uri})</option>)}
                        </select>
                    </div>
                )}

                {(discoveryMode === "manual" || server || (discoveryMode === "auto" && discoveryToken)) && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Name</label>
                            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">URL</label>
                            <input value={formData.baseUrl} onChange={e => setFormData({ ...formData, baseUrl: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Token</label>
                            <input value={formData.token} onChange={e => setFormData({ ...formData, token: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" required />
                        </div>

                        <div className="flex items-center justify-between pt-4">
                            <button type="button" onClick={handleTest} disabled={isTesting} className="text-sm font-bold text-indigo-400 hover:text-indigo-300">
                                {isTesting ? "Testing..." : "Test Connection"}
                            </button>
                            {testResult && (
                                <span className={clsx("text-sm font-bold", testResult.success ? "text-emerald-400" : "text-rose-400")}>{testResult.message}</span>
                            )}
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 mt-4 shadow-lg shadow-amber-500/20">
                            {isSubmitting ? "Saving..." : "Save Server"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

