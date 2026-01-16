"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { AccessUserList } from "@/features/settings/components/access/AccessUserList";

export default function AccessSettingsPage() {
    const { t } = useLanguage();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.access")}
                description={t("settings.accessDesc")}
            >
                <AccessUserList />
            </SettingsSection>
        </div>
    );
}
