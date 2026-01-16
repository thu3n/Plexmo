"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { Save } from "lucide-react";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export function GeneralConfigForm() {
    const { t } = useLanguage();
    const [formAppName, setFormAppName] = useState("");

    const { data: settingsData, mutate: mutateSettings } = useSWR<Record<string, string>>("/api/settings", fetchJson);

    useEffect(() => {
        if (settingsData?.["APP_NAME"]) {
            setFormAppName(settingsData["APP_NAME"]);
        } else {
            setFormAppName("Plexmo");
        }
    }, [settingsData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "APP_NAME", value: formAppName }),
            });
            await mutateSettings();
            alert(t("settings.saveSuccess"));
            window.location.reload();
        } catch (err) {
            alert(t("settings.saveError"));
        }
    };

    return (
        <SettingsCard>
            <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
                <div className="space-y-3 flex-1">
                    <label className="block text-sm font-bold text-white mb-2 ml-1">
                        {t("settings.applicationName")}
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            value={formAppName}
                            onChange={(e) => setFormAppName(e.target.value)}
                            placeholder={t("settings.appNamePlaceholder")}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white placeholder-white/20 focus:border-amber-500/50 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium text-lg"
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-transparent opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
                    </div>
                    <p className="text-xs text-white/40 ml-1">{t("settings.applicationNameDesc")}</p>
                </div>

                <button
                    type="submit"
                    className="h-[56px] px-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold hover:brightness-110 active:scale-95 focus:ring-4 focus:ring-amber-500/20 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                    <Save className="w-5 h-5" />
                    <span>{t("common.save")}</span>
                </button>
            </form>
        </SettingsCard>
    );
}
