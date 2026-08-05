"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { InviteList } from "@/features/settings/components/access/InviteList";

export default function AccessSettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title="Invite links"
                description="One-time links that grant access without knowing someone's email up front. Full onboarding lets a co-admin connect their own Plex server; access only makes them a viewer on yours."
            >
                <InviteList />
            </SettingsSection>
        </div>
    );
}
