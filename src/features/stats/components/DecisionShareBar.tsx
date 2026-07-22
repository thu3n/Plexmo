"use client";

import { DECISION_COLORS, DECISION_LABELS, DECISION_ORDER, type DecisionKey } from "../palette";

type ShareRow = { bucket: string; total: number };

const KEY_BY_BUCKET: Record<string, DecisionKey> = {
    "direct play": "directPlay",
    "direct stream": "directStream",
    "transcode": "transcode",
    "unknown": "unknown",
};

/**
 * Single horizontal 100%-split bar for the overall decision share, with a
 * legend row carrying exact counts — parts of one whole, so one bar, not a pie.
 */
export function DecisionShareBar({ data }: { data: ShareRow[] }) {
    const byKey = new Map<DecisionKey, number>();
    for (const row of data) {
        const key = KEY_BY_BUCKET[row.bucket];
        if (key) byKey.set(key, (byKey.get(key) ?? 0) + row.total);
    }
    const total = Array.from(byKey.values()).reduce((a, b) => a + b, 0);
    const segments = DECISION_ORDER.filter((key) => (byKey.get(key) ?? 0) > 0);

    if (total === 0) {
        return <p className="text-sm text-white/30">No plays in this period</p>;
    }

    return (
        <div>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
                {segments.map((key) => (
                    <div
                        key={key}
                        title={`${DECISION_LABELS[key]}: ${byKey.get(key)}`}
                        style={{
                            width: `${((byKey.get(key) ?? 0) / total) * 100}%`,
                            backgroundColor: DECISION_COLORS[key],
                        }}
                        className="border-r-2 border-black/40 last:border-r-0"
                    />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {segments.map((key) => {
                    const count = byKey.get(key) ?? 0;
                    return (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-white/60">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DECISION_COLORS[key] }} />
                            {DECISION_LABELS[key]}
                            <span className="font-mono text-white/40">
                                {count} ({Math.round((count / total) * 100)}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
