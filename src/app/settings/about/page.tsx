"use client";

import useSWR from "swr";
import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { VersionCard, type VersionInfo } from "@/features/settings/components/about/VersionCard";
import { ProjectInfoCard } from "@/features/settings/components/about/ProjectInfoCard";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";

export default function AboutPage() {
    const { data, isLoading } = useSWR<VersionInfo>("/api/version", fetchJsonOrThrow, { revalidateOnFocus: false });

    return (
        <div className="space-y-8">
            <SettingsSection title="About Plexmo" description="Application version and project information">
                {/* Pairs up only past 1800px — the Version card nests its own
                    two-column grid, which needs the room. */}
                <div className="grid gap-6 min-[1800px]:grid-cols-2 min-[1800px]:items-start">
                    <VersionCard info={data} isLoading={isLoading} />
                    <ProjectInfoCard />
                </div>
            </SettingsSection>
        </div>
    );
}
