"use client";

import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { useDesktopNavMode, type DesktopNavMode } from "@/lib/desktop-nav-preference";

const MODE_OPTIONS: { mode: DesktopNavMode; labelKey: string }[] = [
    { mode: "dropdown", labelKey: "settings.desktopNavDropdown" },
    { mode: "dock", labelKey: "settings.desktopNavDock" },
    { mode: "header", labelKey: "settings.desktopNavHeader" },
];

/**
 * "Desktop navigation" — a per-browser preference (localStorage) picking how
 * primary nav is presented on large screens: user-menu dropdown (default),
 * bottom dock, or header buttons. Below lg the dock is always shown
 * regardless of this choice.
 */
export function DesktopNavCard() {
    const { t } = useLanguage();
    const [mode, setMode] = useDesktopNavMode();

    return (
        <SettingsCard className="hidden lg:block">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                    <h3 className="font-bold text-white">{t("settings.desktopNav")}</h3>
                    <p className="mt-1 text-sm text-white/50">{t("settings.desktopNavDesc")}</p>
                </div>
                <div role="radiogroup" aria-label={t("settings.desktopNav")} className="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1 self-start sm:self-auto">
                    {MODE_OPTIONS.map((option) => (
                        <button
                            key={option.mode}
                            role="radio"
                            aria-checked={mode === option.mode}
                            onClick={() => setMode(option.mode)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                                mode === option.mode
                                    ? "bg-amber-500 text-black"
                                    : "text-white/60 hover:text-white"
                            }`}
                        >
                            {t(option.labelKey)}
                        </button>
                    ))}
                </div>
            </div>
        </SettingsCard>
    );
}
