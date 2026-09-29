import type { ReactNode } from "react";

export type SplitSegment = {
    key: string;
    label: string;
    value: number;
    /** Shown in the legend; defaults to the raw value. */
    display?: string;
    /** Tailwind bg-* for the bar, text-* for the legend accent. */
    barClass: string;
    textClass: string;
    icon?: ReactNode;
};

const PERCENT = 100;
// Tiny non-zero shares still get a visible sliver on the bar.
const MIN_SEGMENT_PERCENT = 2;

/**
 * A whole split into parts: one stacked bar plus a legend with each part's
 * value and share, so the proportions read at a glance instead of being
 * summed across separate cards.
 */
export function SplitBar({ segments, emptyLabel }: { segments: SplitSegment[]; emptyLabel: string }) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    // Three columns can't fit "DIRECT STREAM" at phone width, so a three-way
    // legend becomes label/value rows there and columns from sm up.
    const isThreeWay = segments.length > 2;
    const legendLayout = isThreeWay ? "grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-3" : "grid-cols-2 gap-3";
    const itemLayout = isThreeWay
        ? "flex-row items-center justify-between sm:flex-col sm:items-start sm:justify-start"
        : "flex-col";

    return (
        <div className="flex flex-col gap-3">
            <div
                className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5"
                role="img"
                aria-label={total ? segments.map((s) => `${s.label} ${s.display ?? s.value}`).join(", ") : emptyLabel}
            >
                {total > 0 &&
                    segments
                        .filter((s) => s.value > 0)
                        .map((s) => (
                            <div
                                key={s.key}
                                className={`h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full ${s.barClass}`}
                                style={{ width: `${Math.max((s.value / total) * PERCENT, MIN_SEGMENT_PERCENT)}%` }}
                            />
                        ))}
            </div>
            <div className={`grid ${legendLayout}`}>
                {segments.map((s) => {
                    const share = total ? Math.round((s.value / total) * PERCENT) : 0;
                    return (
                        <div key={s.key} className={`flex min-w-0 gap-1 ${itemLayout}`}>
                            <span className={`flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${s.textClass}`}>
                                {s.icon ?? <span className={`h-2 w-2 shrink-0 rounded-full ${s.barClass}`} />}
                                <span className="truncate">{s.label}</span>
                            </span>
                            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                                <span className="text-lg font-bold leading-none text-white tabular-nums">{s.display ?? s.value}</span>
                                {total > 0 ? <span className="text-[11px] text-white/35 tabular-nums">{share}%</span> : null}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
