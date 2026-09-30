"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";

export const STATS_SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "library", label: "Library" },
    { id: "viewing", label: "Viewing" },
    { id: "people", label: "People" },
    { id: "server", label: "Server" },
] as const;

export type StatsSectionId = (typeof STATS_SECTIONS)[number]["id"];

const isSection = (value: string): value is StatsSectionId => STATS_SECTIONS.some((s) => s.id === value);

const subscribeHash = (onChange: () => void) => {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
};
const readHash = () => window.location.hash.slice(1);
const serverHash = () => "";

/**
 * Active section, kept in the URL hash so a reload or a shared link lands on
 * the same tab. Only the active section mounts, which also keeps the page
 * from firing every stats query at once.
 */
export function useStatsSection(): [StatsSectionId, (id: StatsSectionId) => void] {
    const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);
    const section: StatsSectionId = isSection(hash) ? hash : "overview";

    const select = (id: StatsSectionId) => {
        // replaceState keeps tab switches out of the back-button history;
        // it fires no hashchange, so announce it for the store above.
        window.history.replaceState(null, "", id === "overview" ? window.location.pathname : `#${id}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return [section, select];
}

/** Underline tabs — a different weight from the period/server pills so the two rows don't read as one control. */
export function SectionTabs({ active, onSelect }: { active: StatsSectionId; onSelect: (id: StatsSectionId) => void }) {
    return (
        <nav aria-label="Statistics sections" className="w-full overflow-x-auto no-scrollbar">
            <ul className="flex min-w-max gap-1 border-b border-white/5">
                {STATS_SECTIONS.map((s) => (
                    <li key={s.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(s.id)}
                            aria-current={active === s.id ? "page" : undefined}
                            className={clsx(
                                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                                active === s.id
                                    ? "border-amber-400 text-white"
                                    : "border-transparent text-white/50 hover:text-white/80",
                            )}
                        >
                            {s.label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
