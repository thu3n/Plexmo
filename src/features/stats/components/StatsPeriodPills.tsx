"use client";

import { STATS_PERIODS, type StatsPeriodKey } from "../lib/stats-periods";

/** The page-level period selector — one pill row drives cards, charts and lists. */
export function StatsPeriodPills({
    period,
    onPeriodChange,
}: {
    period: StatsPeriodKey;
    onPeriodChange: (period: StatsPeriodKey) => void;
}) {
    return (
        <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1">
            {STATS_PERIODS.map((p) => (
                <button
                    key={p.key}
                    onClick={() => onPeriodChange(p.key)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${period === p.key ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
