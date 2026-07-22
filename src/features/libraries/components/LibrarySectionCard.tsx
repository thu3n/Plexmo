"use client";

import type { Section } from "../types";

/**
 * One library on one server. Shows title counts (and the section's episode
 * total for show libraries — omitted until the first episode sync fills it).
 */
export function LibrarySectionCard({ section }: { section: Section }) {
    const isShow = section.type === "show";
    const subline = isShow
        ? section.episodeCount > 0
            ? `shows · ${section.episodeCount.toLocaleString()} episodes`
            : "shows"
        : "movies";

    return (
        <div className="rounded-2xl glass-panel border border-white/5 p-4">
            <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={isShow ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"}
                    alt={section.type}
                    className="h-4 w-4 opacity-60"
                />
                <p className="truncate font-medium text-white/90">{section.title}</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-white/90">{section.itemCount ?? 0}</p>
            <p className="text-xs text-white/40">{subline}</p>
        </div>
    );
}
