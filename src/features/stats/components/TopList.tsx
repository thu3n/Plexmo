"use client";

import type { ReactNode } from "react";
import { SkeletonRows } from "@/components/Skeleton";

export type TopListItem = {
    key: string | number;
    label: string;
    sublabel?: string;
    value: number;
    valueLabel: string;
    icon?: ReactNode;
};

type TopListProps = {
    title: string;
    items: TopListItem[];
    emptyText: string;
    isLoading?: boolean;
    /** Optional control rendered on the header's right edge (e.g. a toggle). */
    headerExtra?: ReactNode;
};

/**
 * Ranked list with proportional value bars — magnitude comparison across a
 * small set of named entities (users, titles, platforms). One measure, one
 * hue: the bar is neutral; identity lives in the label, not a color.
 */
export function TopList({ title, items, emptyText, isLoading = false, headerExtra }: TopListProps) {
    const max = items.length > 0 ? Math.max(...items.map((i) => i.value)) : 0;

    return (
        <div className="rounded-2xl glass-panel border border-white/5 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white/40">{title}</h3>
                {headerExtra}
            </div>
            {isLoading ? (
                <SkeletonRows count={5} rowClassName="h-9 rounded-lg" />
            ) : items.length === 0 ? (
                <p className="text-sm text-white/30">{emptyText}</p>
            ) : (
                <ol className="space-y-3">
                    {items.map((item, index) => (
                        <li key={item.key} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-right text-xs font-bold text-white/30">{index + 1}</span>
                            {item.icon}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-white/90" title={item.label}>
                                        {item.label}
                                    </span>
                                    <span className="shrink-0 text-xs font-mono text-white/50">{item.valueLabel}</span>
                                </div>
                                {item.sublabel && (
                                    <p className="truncate text-[11px] text-white/40">{item.sublabel}</p>
                                )}
                                <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                                    <div
                                        className="h-full rounded-full bg-amber-400/60"
                                        style={{ width: max > 0 ? `${Math.max(2, (item.value / max) * 100)}%` : 0 }}
                                    />
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

/** Seconds -> "3h 24m" (or "42m"). */
export const formatWatchTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
