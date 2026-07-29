"use client";

import useSWR from "swr";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { Trash2, ShieldCheck, Clock, Lock } from "lucide-react";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export function AccessUserList() {
    const { t } = useLanguage();
    const locale = 'en-US';
    const { data, mutate, isLoading } = useSWR<{ users: any[] }>("/api/settings/access", fetchJson);

    const handleDelete = async (id: string) => {
        if (!confirm(t("settings.confirmDelete"))) return;
        try {
            await fetch(`/api/settings/access?id=${id}`, { method: "DELETE" });
            mutate();
        } catch {
            alert("Failed to delete");
        }
    };

    return (
        <div className="grid gap-4 2xl:grid-cols-2">
            {isLoading ? (
                [1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)
            ) : data?.users.length === 0 ? (
                <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-3xl 2xl:col-span-2">
                    {t("settings.noAllowedUsers")}
                </div>
            ) : (
                data?.users.map(user => (
                    <SettingsCard key={user.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-white truncate">{user.email}</h4>
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
                            className="shrink-0 p-2 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </SettingsCard>
                ))
            )}
        </div>
    );
}
