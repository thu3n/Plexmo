"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { AccessUserList } from "@/features/settings/components/access/AccessUserList";
import { InviteList } from "@/features/settings/components/access/InviteList";

export default function AccessSettingsPage() {
    const { t } = useLanguage();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title="Invite links"
                description="One-time links that onboard a friend: full onboarding lets them connect their own Plex server, access-only makes them a viewer."
            >
                <InviteList />
            </SettingsSection>
            <SettingsSection
                title={t("settings.access")}
                description={t("settings.accessDesc")}
            >
                <AccessUserList />
            </SettingsSection>
        </div>
    );
}
