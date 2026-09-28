"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { useClientSettings } from "@/features/settings/hooks/useClientSettings";
import { APP_NAME_KEY, APP_NAME_MAX_LENGTH, DEFAULT_APP_NAME, validateAppName } from "@/lib/settings-validation";

export function GeneralConfigForm() {
    const { t } = useLanguage();
    const router = useRouter();
    const { toast } = useFeedback();
    const { settings, saveSettings } = useClientSettings();
    const [formAppName, setFormAppName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const savedAppName = settings?.[APP_NAME_KEY] || DEFAULT_APP_NAME;

    // Mirror each fresh settings payload into the input during render. The null
    // seed never equals SWR's undefined, so the fallback shows on mount.
    const [syncedSettings, setSyncedSettings] = useState<Record<string, string> | undefined | null>(null);
    if (settings !== syncedSettings) {
        setSyncedSettings(settings);
        setFormAppName(savedAppName);
    }

    const validation = validateAppName(formAppName);
    const isUnchanged = formAppName.trim() === savedAppName;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validation.ok) {
            toast(validation.error, "error");
            return;
        }
        setIsSaving(true);
        try {
            await saveSettings({ [APP_NAME_KEY]: validation.value });
            // Re-renders server components so the root layout's metadata title
            // picks up the new name without a full page reload.
            router.refresh();
            toast(t("settings.saveSuccess"));
        } catch (err) {
            toast(errorMessage(err, t("settings.saveError")), "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SettingsCard>
            <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
                <div className="space-y-3 flex-1 min-w-0 2xl:max-w-2xl">
                    <label htmlFor="app-name" className="block text-sm font-bold text-white mb-2 ml-1">
                        {t("settings.applicationName")}
                    </label>
                    <div className="relative group">
                        <input
                            id="app-name"
                            type="text"
                            value={formAppName}
                            maxLength={APP_NAME_MAX_LENGTH}
                            onChange={(e) => setFormAppName(e.target.value)}
                            placeholder={t("settings.appNamePlaceholder")}
                            aria-invalid={!validation.ok}
                            aria-describedby="app-name-hint"
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-white placeholder-white/20 focus:border-amber-500/50 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium text-lg"
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-transparent opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
                    </div>
                    <p id="app-name-hint" className={validation.ok ? "text-xs text-white/40 ml-1" : "text-xs text-rose-400 ml-1"}>
                        {validation.ok ? t("settings.applicationNameDesc") : validation.error}
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={isSaving || isUnchanged || !validation.ok}
                    className="h-[56px] px-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold hover:brightness-110 active:scale-95 focus:ring-4 focus:ring-amber-500/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:brightness-100"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    <span>{t("common.save")}</span>
                </button>
            </form>
        </SettingsCard>
    );
}
