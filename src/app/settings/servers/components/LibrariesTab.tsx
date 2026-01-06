"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { SettingsSection, SettingsCard } from "../../components/SettingsComponents";
import { useLanguage } from "@/components/LanguageContext";
import { Folder, RefreshCw, Eye } from "lucide-react";
import clsx from "clsx";
import type { LibrarySection } from "@/lib/plex";
import type { PublicServer } from "@/lib/servers";
import { LibraryGroupsManager } from "./LibraryGroupsManager";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export function LibrariesTab() {
    const { t } = useLanguage();
    const { data: dashboardData, isLoading: dashboardLoading } = useSWR<{ libraries: LibrarySection[] }>("/api/dashboard", fetchJson);
    const { data: serversData } = useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson);
    const { data: jobsData, mutate: mutateJobs } = useSWR<{ jobs: any[] }>("/api/jobs", fetchJson, { refreshInterval: 2000 });

    const activeListSync = jobsData?.jobs?.find(j => j.type === 'sync_all_library_lists' && ['running', 'pending'].includes(j.status));

    const handleGlobalSync = async () => {
        if (activeListSync) return;
        try {
            await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: 'sync_all_library_lists' }),
            });
            mutateJobs();
        } catch { }
    };

    const [filterServerId, setFilterServerId] = useState("");

    const libraries = dashboardData?.libraries ?? [];

    // Generate dynamic example text
    const exampleText = (() => {
        const uniqueServers = Array.from(new Set(libraries.map(l => l.serverName || "Unknown")));
        if (uniqueServers.length >= 2) {
            const server1 = uniqueServers[0];
            const server2 = uniqueServers[1];
            const lib1 = libraries.find(l => l.serverName === server1)?.title || "Movies";
            const lib2 = libraries.find(l => l.serverName === server2)?.title || "Movies";

            return t("settings.librariesExample")
                .replace("{0}", lib1)
                .replace("{1}", server1)
                .replace("{2}", lib2)
                .replace("{3}", server2);
        }
        return t("settings.librariesExamplePlaceholder");
    })();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.libraries")}
                description={`${t("settings.librariesDesc")} ${exampleText}`}
            >
                <div className="mb-12">
                    <LibraryGroupsManager
                        libraries={libraries}
                        onSync={handleGlobalSync}
                        isSyncing={!!activeListSync}
                    />
                </div>


                {/* Individual Libraries List Hidden by Request */}
            </SettingsSection>
        </div >
    );
}
