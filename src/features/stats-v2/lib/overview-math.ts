/**
 * Pure helpers for the Statistics v2 overview. Unit-tested in
 * src/features/stats-v2/tests/overview-math.test.ts.
 */

export const HEATMAP_HOURS = 24;
/** Screenshot order: Monday first. Values are SQLite %w (0 = Sunday). */
export const HEATMAP_WEEKDAYS: { key: number; label: string }[] = [
    { key: 1, label: "Mon" },
    { key: 2, label: "Tue" },
    { key: 3, label: "Wed" },
    { key: 4, label: "Thu" },
    { key: 5, label: "Fri" },
    { key: 6, label: "Sat" },
    { key: 0, label: "Sun" },
];

const SECONDS_PER_HOUR = 3600;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const formatCount = (n: number): string => Math.round(n).toLocaleString("en-US");

/** "62,561 h" style — whole hours, thousands-separated. */
export const formatHours = (seconds: number): string =>
    `${formatCount(seconds / SECONDS_PER_HOUR)}h`;

export const percentOf = (part: number, total: number): number =>
    total > 0 ? Math.round((part / total) * 100) : 0;

/**
 * Change of the current window vs. the one before it, derived from a total over
 * the doubled window (previous = doubled − current). Only valid for additive
 * metrics — distinct counts (users) can't be split this way.
 */
export const trendPercent = (current: number, doubledWindowTotal: number): number | null => {
    const previous = doubledWindowTotal - current;
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
};

/** 7 × 24 matrix (rows in HEATMAP_WEEKDAYS order) from "<%w>-<%H>" buckets. */
export const buildHeatmapGrid = (rows: { bucket: string; total: number }[]): number[][] => {
    const byKey = new Map(rows.map((r) => [r.bucket, r.total]));
    return HEATMAP_WEEKDAYS.map(({ key }) =>
        Array.from({ length: HEATMAP_HOURS }, (_, hour) =>
            byKey.get(`${key}-${String(hour).padStart(2, "0")}`) ?? 0,
        ),
    );
};

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** "Sep 1, 2025 – Sep 28, 2026" for the header chip. */
export const formatDateRange = (days: number, now: number, firstActivity?: number): string => {
    const windowStart = now - days * MS_PER_DAY;
    // "All time" windows reach back 20 years — clamp to the first recorded play.
    const start = firstActivity && firstActivity > windowStart ? firstActivity : windowStart;
    const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", DATE_FMT);
    return `${fmt(start)} – ${fmt(now)}`;
};

const MONTH_FMT: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };

/** Axis label for a "YYYY-MM" or "YYYY-MM-DD" bucket. */
export const formatBucketLabel = (bucket: string): string => {
    const [y, m, d] = bucket.split("-").map(Number);
    if (!y || !m) return bucket;
    const date = new Date(y, m - 1, d || 1);
    return d
        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : date.toLocaleDateString("en-US", MONTH_FMT);
};
