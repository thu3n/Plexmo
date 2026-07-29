"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { GeneralConfigForm } from "@/features/settings/components/general/GeneralConfigForm";
import { ApiKeyManager } from "@/features/settings/components/general/ApiKeyManager";
import { DesktopNavCard } from "@/features/settings/components/general/DesktopNavCard";

export default function GeneralSettingsPage() {
    const { t } = useLanguage();

    return (
        <div className="space-y-8">
            <SettingsSection
                title={t("settings.general")}
                description="Manage global application settings and preferences."
            >
                <div className="grid gap-6 2xl:grid-cols-2 2xl:items-start">
                    {/* The config form carries the save bar, so it keeps the full row. */}
                    <div className="2xl:col-span-2">
                        <GeneralConfigForm />
                    </div>
                    <DesktopNavCard />
                    <ApiKeyManager />
                </div>
            </SettingsSection>
        </div>
    );
}
