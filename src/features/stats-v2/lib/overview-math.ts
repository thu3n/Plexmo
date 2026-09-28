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

/** "37%", or "<1%" for a real but tiny share (a plain "0%" reads as none at all). */
export const formatShare = (part: number, total: number): string => {
    const percent = percentOf(part, total);
    return percent === 0 && part > 0 ? "<1%" : `${percent}%`;
};

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

const formatResolution = (value: string): string => {
    const v = value.trim();
    if (/^\d{3,4}p?$/i.test(v)) return `${v.replace(/p$/i, "")}p`;
    return v.toUpperCase();
};

/** "4k → 1080" → "4K → 1080p", "1080p → sd" → "1080p → SD". */
export const formatResolutionChange = (detail: string): string =>
    detail.split("→").map(formatResolution).join(" → ");

/**
 * Quantile thresholds over the non-zero cells, so a few extreme evening cells
 * can't flatten every other cell into one shade (the linear-alpha problem).
 * Returns ascending upper bounds, one per non-empty level.
 */
export const quantileThresholds = (values: number[], levels: number): number[] => {
    const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    return Array.from({ length: levels }, (_, i) =>
        sorted[Math.min(sorted.length - 1, Math.floor(((i + 1) / levels) * sorted.length) - 1)] ?? sorted[0],
    );
};

/** 0 = empty cell, 1..levels by quantile bucket. */
export const levelFor = (value: number, thresholds: number[]): number => {
    if (value <= 0 || thresholds.length === 0) return 0;
    const idx = thresholds.findIndex((t) => value <= t);
    return idx === -1 ? thresholds.length : idx + 1;
};

/** One-decimal hours — short windows would otherwise flatten to 0h on the chart. */
export const secondsToChartHours = (seconds: number): number =>
    Math.round((seconds / SECONDS_PER_HOUR) * 10) / 10;

const NAMED_RESOLUTIONS: Record<string, number> = { "8k": 4320, "4k": 2160, sd: 480 };

/** Sortable height for a resolution label ("4k", "1080", "720p", "sd"); unknown → 0. */
export const resolutionRank = (value: string): number => {
    const v = value.trim().toLowerCase();
    if (v in NAMED_RESOLUTIONS) return NAMED_RESOLUTIONS[v];
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
};

/** Lower height bounds per quality class, best first; anything below the last is SD. */
const RESOLUTION_CLASSES: { label: string; min: number }[] = [
    { label: "4K", min: 1500 },
    { label: "1080p", min: 900 },
    { label: "720p", min: 600 },
];

/**
 * Collapse raw delivered heights (Plex reports e.g. 1072 or 804 for cropped or
 * scaled streams) into the four classes people think in. Unknown rows drop out.
 */
export const groupResolutions = (rows: { bucket: string; total: number }[]): { label: string; total: number }[] => {
    const totals = new Map<string, number>([...RESOLUTION_CLASSES.map((c) => [c.label, 0] as const), ["SD", 0]]);
    for (const row of rows) {
        const height = resolutionRank(row.bucket);
        if (height === 0) continue;
        const label = RESOLUTION_CLASSES.find((c) => height >= c.min)?.label ?? "SD";
        totals.set(label, (totals.get(label) ?? 0) + row.total);
    }
    return [...totals].filter(([, total]) => total > 0).map(([label, total]) => ({ label, total }));
};
