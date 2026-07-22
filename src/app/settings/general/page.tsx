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
                <div className="grid gap-6">
                    <GeneralConfigForm />
                    <DesktopNavCard />
                    <ApiKeyManager />
                </div>
            </SettingsSection>
        </div>
    );
}
