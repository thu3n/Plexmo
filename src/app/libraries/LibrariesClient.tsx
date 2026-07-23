"use client";

import { useState } from "react";
import useSWR from "swr";
import { RefreshCw } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { Skeleton } from "@/components/Skeleton";
import { LibraryStatCards } from "@/features/libraries/components/LibraryStatCards";
import { LibrarySectionCard } from "@/features/libraries/components/LibrarySectionCard";
import { RecentlyAddedGrid } from "@/features/libraries/components/RecentlyAddedGrid";
import type { LibrariesResponse, Section } from "@/features/libraries/types";

const SECTION_SKELETON_COUNT = 4;

const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to fetch libraries");
    return res.json();
};

export function LibrariesClient() {
    const { data, error, isLoading } = useSWR<LibrariesResponse>("/api/libraries", fetcher, {
        revalidateOnFocus: false,
        // While the inventory is empty (fresh install waiting on its first
        // sync), keep polling so sections appear as the sync lands.
        refreshInterval: (latest) => (latest?.sections?.length ? 0 : 5000),
    });
    const [syncRequested, setSyncRequested] = useState(false);

    const triggerSync = async () => {
        setSyncRequested(true);
        try {
            await fetch("/api/libraries/sync", { method: "POST" });
        } catch {
            setSyncRequested(false);
        }
    };

    // Group sections per server — library counts stay per-server, never summed.
    const byServer = new Map<string, { name: string; sections: Section[] }>();
    for (const section of data?.sections ?? []) {
        if (!byServer.has(section.serverId)) {
            byServer.set(section.serverId, {
                name: section.serverName || "Unknown server",
                sections: [],
            });
        }
        byServer.get(section.serverId)!.sections.push(section);
    }

    const movies = data?.uniqueTitles.find((u) => u.type === "movie");
    const shows = data?.uniqueTitles.find((u) => u.type === "show");

    return (
        <div className="relative min-h-dvh">
            <header className="fixed top-0 inset-x-0 z-50 border-b bg-black/80 border-white/5 safe-top">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-white/90">Libraries</h1>
                    <div className="flex items-center gap-4">
                        <HeaderNav />
                        <UserMenu align="top-right" />
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock space-y-8">
                {error && (
                    <div className="rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                        {error.message}
                    </div>
                )}

                <LibraryStatCards movies={movies} shows={shows} episodes={data?.uniqueEpisodes} isLoading={isLoading} />

                {isLoading && (
                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: SECTION_SKELETON_COUNT }, (_, i) => (
                            <Skeleton key={i} className="h-28 rounded-2xl" />
                        ))}
                    </section>
                )}

                {/* Per-server sections */}
                {Array.from(byServer.entries()).map(([serverId, server]) => (
                    <section key={serverId}>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">{server.name}</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {server.sections.map((section) => (
                                <LibrarySectionCard key={section.sectionKey} section={section} />
                            ))}
                        </div>
                    </section>
                ))}

                {!error && !isLoading && byServer.size === 0 && (
                    <div className="rounded-2xl glass-panel border border-white/5 p-10 text-center text-white/40 space-y-4">
                        <p>No libraries synced yet.</p>
                        <button
                            onClick={triggerSync}
                            disabled={syncRequested}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
                        >
                            <RefreshCw className={syncRequested ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                            {syncRequested ? "Syncing..." : "Sync now"}
                        </button>
                    </div>
                )}

                <RecentlyAddedGrid items={data?.recentlyAdded ?? []} isLoading={isLoading} />
            </main>
        </div>
    );
}
