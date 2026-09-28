"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { WebhookList } from "@/features/notifications/components/WebhookList";
import { TemplateEditor } from "@/features/notifications/components/TemplateEditor";

export default function NotificationsSettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SettingsSection title="Notifications" description="Configure how you want to be notified about events.">
                <WebhookList />
            </SettingsSection>
            <SettingsSection
                title="Message templates"
                description="Customise the Discord message for each event. Templates apply to every webhook."
            >
                <TemplateEditor />
            </SettingsSection>
        </div>
    );
}
