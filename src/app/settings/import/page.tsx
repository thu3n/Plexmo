"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { BackupRestoreCard } from "@/features/backup/components/BackupRestoreCard";
import TautulliApiImportCard from "@/features/settings/components/import/TautulliApiImportCard";
import TautulliDbImportCard from "@/features/settings/components/import/TautulliDbImportCard";

export default function ImportSettingsPage() {
    return (
        <div className="space-y-8 relative">
            <SettingsSection title="Data Management" description="Export your data for backup or import from other sources.">
                <div className="grid gap-6 2xl:grid-cols-2 2xl:items-start">
                    <BackupRestoreCard />
                    <TautulliApiImportCard />
                </div>
            </SettingsSection>

            <SettingsSection
                title="Tautulli Database File"
                description="Full-fidelity import directly from a tautulli.db file - including data the API can't deliver."
            >
                <TautulliDbImportCard />
            </SettingsSection>
        </div>
    );
}
