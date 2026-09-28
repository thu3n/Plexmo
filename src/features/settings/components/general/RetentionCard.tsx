"use client";

import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Skeleton } from "@/components/Skeleton";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { useClientSettings } from "@/features/settings/hooks/useClientSettings";
import { RETENTION_DEFAULTS, RETENTION_LAST_RUN_KEY, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "@/lib/retention-config";
import {
    buildRetentionForm,
    diffRetentionForm,
    RETENTION_LABELS,
    RETENTION_WINDOWS,
    type RetentionForm,
} from "@/features/settings/lib/retention-form";

/** YYYY-MM-DD (the sweep's local-date key) → the viewer's locale. */
const formatRunDate = (key: string | undefined): string | null => {
    if (!key) return null;
    const [y, m, d] = key.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

/** Data retention windows for the daily sweep (src/lib/retention.ts). */
export function RetentionCard() {
    const { toast } = useFeedback();
    const { settings, isLoading, saveSettings } = useClientSettings();
    const [form, setForm] = useState<RetentionForm | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const saved = buildRetentionForm(settings);
    const [syncedSettings, setSyncedSettings] = useState<Record<string, string> | undefined | null>(null);
    if (settings !== syncedSettings) {
        setSyncedSettings(settings);
        setForm(buildRetentionForm(settings));
    }

    const current = form ?? saved;
    const diff = diffRetentionForm(current, saved);
    const hasChanges = diff.ok && Object.keys(diff.changes).length > 0;
    const lastRun = formatRunDate(settings?.[RETENTION_LAST_RUN_KEY]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!diff.ok || !hasChanges) return;
        setIsSaving(true);
        try {
            await saveSettings(diff.changes);
            toast("Retention settings saved");
        } catch (err) {
            toast(errorMessage(err, "Failed to save retention settings"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SettingsCard>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">Data Retention</h3>
                        <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                            How long operational data is kept before the daily cleanup removes it. Watch history is never pruned.
                        </p>
                    </div>
                    <Trash2 className="w-6 h-6 text-white/20 shrink-0" />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    {RETENTION_WINDOWS.map((window) => {
                        const error = diff.ok ? undefined : diff.errors[window];
                        const id = `retention-${window}`;
                        return (
                            <div key={window} className="space-y-2">
                                <label htmlFor={id} className="block text-sm font-bold text-white">
                                    {RETENTION_LABELS[window].label}
                                </label>
                                {isLoading ? (
                                    <Skeleton className="h-[46px] rounded-xl" />
                                ) : (
                                    <div className="relative">
                                        <input
                                            id={id}
                                            type="number"
                                            inputMode="numeric"
                                            min={RETENTION_MIN_DAYS}
                                            max={RETENTION_MAX_DAYS}
                                            step={1}
                                            value={current[window]}
                                            onChange={(e) => setForm({ ...current, [window]: e.target.value })}
                                            aria-invalid={Boolean(error)}
                                            aria-describedby={`${id}-hint`}
                                            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-14 text-white focus:border-amber-500/50 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">days</span>
                                    </div>
                                )}
                                <p id={`${id}-hint`} className={error ? "text-xs text-rose-400" : "text-xs text-white/40"}>
                                    {error ?? `${RETENTION_LABELS[window].description} Default: ${RETENTION_DEFAULTS[window]} days.`}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/5">
                    <p className="text-xs text-white/40">
                        {lastRun ? `Last cleanup: ${lastRun}` : "Cleanup has not run yet"}
                    </p>
                    <button
                        type="submit"
                        disabled={isSaving || !hasChanges}
                        className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save retention
                    </button>
                </div>
            </form>
        </SettingsCard>
    );
}
