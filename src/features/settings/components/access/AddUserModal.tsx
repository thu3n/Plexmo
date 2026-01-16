"use client";

import { useState } from "react";
import { useSWRConfig } from "swr"; // To trigger global mutate
import { useLanguage } from "@/components/LanguageContext";

export function AddUserModal({
    isOpen,
    onClose
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { t } = useLanguage();
    const { mutate } = useSWRConfig();

    // Form State
    const [email, setEmail] = useState("");
    const [removeAfterLogin, setRemoveAfterLogin] = useState(true);
    const [neverExpire, setNeverExpire] = useState(false);
    const [expiryDate, setExpiryDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            onClose();
            mutate("/api/settings/access"); // Trigger re-fetch of list
        } catch (e: any) {
            alert(e.message || "Error adding user");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
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
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition disabled:opacity-50">Add User</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
