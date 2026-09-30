"use client";

import type { DropOffBucket } from "@/lib/stats/viewing-behaviour-completion";
import { WATCHED_THRESHOLD_PERCENT } from "@/lib/history/session-facts";
import { Skeleton } from "@/components/Skeleton";
import { ACCENT, DECISION_COLORS, TRACK } from "../../lib/theme";

/** Emerald = the same "good outcome" green the decision bar uses for direct play. */
const FINISHED_COLOR = DECISION_COLORS.directPlay;
const AXIS_TICKS = [0, 25, 50, 75, 100];
/** Keeps a non-empty bucket visible next to a dominant one. */
const MIN_BAR_PERCENT = 2;

/**
 * Where attempts ended, as share of runtime. Plain CSS bars (20 columns) —
 * fluid down to 360px without a chart library's fixed margins.
 */
export function DropOffHistogram({ buckets }: { buckets: DropOffBucket[] | undefined }) {
    if (!buckets) return <Skeleton className="h-32 w-full rounded-xl" />;
    const max = Math.max(...buckets.map((b) => b.attempts), 1);

    return (
        <figure>
            <div
                className="flex h-28 items-end gap-[2px] border-b"
                style={{ borderColor: TRACK }}
                role="img"
                aria-label="Histogram of where viewers stopped, by percent of runtime"
            >
                {buckets.map((b) => (
                    <div
                        key={b.from}
                        className="flex-1 rounded-t-sm transition-opacity hover:opacity-80"
                        title={`${b.from}–${b.to}%: ${b.attempts.toLocaleString("en-US")} ${b.finished ? "finished" : "stopped"}`}
                        style={{
                            height: b.attempts > 0 ? `${Math.max(MIN_BAR_PERCENT, (b.attempts / max) * 100)}%` : 0,
                            backgroundColor: b.finished ? FINISHED_COLOR : ACCENT,
                            opacity: b.finished ? 0.9 : 0.8,
                        }}
                    />
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/40">
                {AXIS_TICKS.map((t) => <span key={t}>{t}%</span>)}
            </div>
            <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium">
                <span style={{ color: ACCENT }}>Stopped here</span>
                <span style={{ color: FINISHED_COLOR }}>Finished ({WATCHED_THRESHOLD_PERCENT}%+)</span>
            </figcaption>
        </figure>
    );
}
