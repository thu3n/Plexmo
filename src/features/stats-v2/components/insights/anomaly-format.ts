import type { AnomalySeverity } from "@/lib/stats/anomalies-detect";

/** Pure display helpers for the anomalies panel. */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const formatAgo = (ms: number, now: number): string => {
    const diff = Math.max(0, now - ms);
    if (diff < HOUR_MS) return "just now";
    if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
    const days = Math.floor(diff / DAY_MS);
    return days === 1 ? "yesterday" : `${days} days ago`;
};

/** "Ongoing" once an incident has been re-observed by a later scan. */
export const isOngoing = (firstDetectedAt: number, lastSeenAt: number): boolean => lastSeenAt > firstDetectedAt;

/** Tailwind classes per severity — rose/amber/sky match the app's decision palette. */
export const SEVERITY_STYLES: Record<AnomalySeverity, { pill: string; dot: string; label: string }> = {
    critical: { pill: "bg-rose-500/15 text-rose-300 ring-rose-400/20", dot: "bg-rose-400", label: "Critical" },
    warning: { pill: "bg-amber-500/15 text-amber-300 ring-amber-400/20", dot: "bg-amber-400", label: "Warning" },
    info: { pill: "bg-sky-500/15 text-sky-300 ring-sky-400/20", dot: "bg-sky-400", label: "Info" },
};
