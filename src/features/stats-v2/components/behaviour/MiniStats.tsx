"use client";

import { INSET_CLASS } from "../../lib/theme";

export type MiniStat = { label: string; value: string };

/**
 * Compact headline numbers above a behaviour list. Always a 3-up grid, never
 * wrapping into a ragged row; values shrink to text-base below `sm`.
 */
export function MiniStats({ stats }: { stats: MiniStat[] | undefined }) {
    return (
        <div className="mb-4 grid grid-cols-3 gap-2">
            {(stats ?? PLACEHOLDER).map((s) => (
                <div key={s.label} className={`${INSET_CLASS} min-w-0 px-2.5 py-2`}>
                    <p className="truncate text-base font-semibold tabular-nums text-white sm:text-lg">{s.value}</p>
                    <p className="truncate text-[10px] uppercase tracking-wide text-white/45">{s.label}</p>
                </div>
            ))}
        </div>
    );
}

const PLACEHOLDER: MiniStat[] = [
    { label: " ", value: "–" },
    { label: "  ", value: "–" },
    { label: "   ", value: "–" },
];
