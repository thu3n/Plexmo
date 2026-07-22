"use client";

import type { UserStats } from "@/lib/user_stats";
import { formatWatchTime } from "@/features/stats/components/TopList";
import { USER_PERIODS, type PeriodKey } from "../lib/periods";

// Static variant map — full literal class strings (Tailwind v4 purges
// dynamically built names). One accent per period, selected state only;
// unselected chips share the neutral look.
const CHIP_VARIANTS: Record<PeriodKey, { selected: string; value: string }> = {
    "24h": {
        selected: "bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30",
        value: "text-emerald-300",
    },
    "7d": {
        selected: "bg-cyan-500/15 border-cyan-500/40 ring-1 ring-cyan-500/30",
        value: "text-cyan-300",
    },
    "30d": {
        selected: "bg-indigo-500/15 border-indigo-500/40 ring-1 ring-indigo-500/30",
        value: "text-indigo-300",
    },
    "1y": {
        selected: "bg-violet-500/15 border-violet-500/40 ring-1 ring-violet-500/30",
        value: "text-violet-300",
    },
    all: {
        selected: "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30",
        value: "text-amber-300",
    },
};

/**
 * The period stat cards and the chart period selector, woven into one
 * control: each chip shows the period's plays + watch time AND filters the
 * charts below when selected. Horizontal scroll row on mobile, equal-width
 * grid from md.
 */
export function UserPeriodChips({
    global,
    selected,
    onSelect,
}: {
    global: UserStats["global"];
    selected: PeriodKey;
    onSelect: (period: PeriodKey) => void;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar md:grid md:grid-cols-5">
            {USER_PERIODS.map((period) => {
                const stat = global[period.statKey];
                const isSelected = selected === period.key;
                const variant = CHIP_VARIANTS[period.key];
                return (
                    <button
                        key={period.key}
                        aria-pressed={isSelected}
                        onClick={() => onSelect(period.key)}
                        className={`shrink-0 min-w-[7.5rem] md:min-w-0 rounded-2xl border px-4 py-3 text-left transition-all ${
                            isSelected
                                ? variant.selected
                                : "border-white/5 bg-white/5 hover:bg-white/10"
                        }`}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                            {period.label}
                        </p>
                        <p className="mt-0.5 text-xl font-bold text-white">
                            {stat.count}
                            <span className="ml-1 text-xs font-medium text-white/40">plays</span>
                        </p>
                        <p className={`text-xs font-medium ${isSelected ? variant.value : "text-white/40"}`}>
                            {formatWatchTime(stat.duration)}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}
