"use client";

import { SkeletonStatCard } from "@/components/Skeleton";
import type { UniqueTitles, UniqueEpisodes } from "../types";

/**
 * Cross-server headline stats — the only honest aggregates: unique titles and
 * episodes counted on canonical identity, never naive per-server sums.
 */
export function LibraryStatCards({
    movies,
    shows,
    episodes,
    isLoading,
}: {
    movies?: UniqueTitles;
    shows?: UniqueTitles;
    episodes?: UniqueEpisodes;
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <section className="grid gap-4 sm:grid-cols-3 max-w-3xl">
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
            </section>
        );
    }

    const cards = [
        { label: "Unique movies", count: movies?.uniqueCount, copies: movies?.totalCopies, emptyText: "No synced libraries yet" },
        { label: "Unique shows", count: shows?.uniqueCount, copies: shows?.totalCopies, emptyText: "No synced libraries yet" },
        { label: "Unique episodes", count: episodes?.uniqueCount, copies: episodes?.totalCopies, emptyText: "No synced episodes yet" },
    ];

    return (
        <section className="grid gap-4 sm:grid-cols-3 max-w-3xl">
            {cards.map(({ label, count, copies, emptyText }) => (
                <div key={label} className="rounded-2xl glass-panel border border-white/5 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</p>
                    <p className="mt-1 text-3xl font-bold text-white/90">{count ?? 0}</p>
                    <p className="text-xs text-white/40">
                        {copies ? `${copies} copies across servers` : emptyText}
                    </p>
                </div>
            ))}
        </section>
    );
}
