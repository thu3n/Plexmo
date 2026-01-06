"use client";

import { useState } from "react";
import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Plus, Trash2, ShieldCheck, Calendar, Clock, Lock } from "lucide-react";
import clsx from "clsx";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export default function AccessSettingsPage() {
    const { t } = useLanguage();
    const locale = 'en-US';
    const { data, mutate, isLoading } = useSWR<{ users: any[] }>("/api/settings/access", fetchJson);

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [email, setEmail] = useState("");
    const [removeAfterLogin, setRemoveAfterLogin] = useState(true);
    const [neverExpire, setNeverExpire] = useState(false);
    const [expiryDate, setExpiryDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDelete = async (id: string) => {
        if (!confirm(t("settings.confirmDelete"))) return;
        try {
            await fetch(`/api/settings/access?id=${id}`, { method: "DELETE" });
            mutate();
        } catch {
            alert("Failed to delete");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/settings/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    removeAfterLogin: removeAfterLogin ? 1 : 0,
                    expiresAt: !removeAfterLogin && !neverExpire && expiryDate ? new Date(expiryDate).toISOString() : null
                }),
            });
            if (!res.ok) throw new Error("Failed");

            // Reset & Close
            setEmail("");
            setRemoveAfterLogin(true);
            setNeverExpire(false);
            setExpiryDate("");
            setIsModalOpen(false);
            mutate();
        } catch (e: any) {
            alert(e.message || "Error adding user");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.access")}
                description={t("settings.accessDesc")}
            >
                <div className="mb-8">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        {t("settings.addUser")}
                    </button>
                </div>

                <div className="grid gap-4">
                    {isLoading ? (
                        [1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)
                    ) : data?.users.length === 0 ? (
                        <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-3xl">
                            {t("settings.noAllowedUsers")}
                        </div>
                    ) : (
                        data?.users.map(user => (
                            <SettingsCard key={user.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                                        {user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{user.email}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            {user.removeAfterLogin === 1 ? (
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    <Lock className="w-3 h-3" /> One-Time
                                                </span>
                                            ) : user.expiresAt ? (
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                    <Clock className="w-3 h-3" /> Expires: {new Date(user.expiresAt).toLocaleDateString(locale)}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <ShieldCheck className="w-3 h-3" /> Permanent
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(user.id)}
                                    className="p-2 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </SettingsCard>
                        ))
                    )}
                </div>
            </SettingsSection>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl relative">
                        <h2 className="text-2xl font-bold text-white mb-6">{t("settings.addUser")}</h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={removeAfterLogin}
                                        onChange={e => {
                                            setRemoveAfterLogin(e.target.checked);
                                            if (e.target.checked) {
                                                setNeverExpire(false);
                                                setExpiryDate("");
                                            }
                                        }}
                                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-white">One-time Access</span>
                                </label>

                                {!removeAfterLogin && (
                                    <div className="space-y-3 pt-2 animate-in slide-in-from-top-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={neverExpire}
                                                onChange={e => setNeverExpire(e.target.checked)}
                                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500"
                                            />
                                            <span className="text-sm font-medium text-white">Never Expire</span>
                                        </label>

                                        {!neverExpire && (
                                            <div>
                                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Expiration Date</label>
                                                <input
                                                    type="datetime-local"
                                                    value={expiryDate}
                                                    onChange={e => setExpiryDate(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                                                    required={!neverExpire}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition disabled:opacity-50">Add User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
