import type { FirstPlayBucketKey } from "@/lib/stats/library-value-timing";

/**
 * Pure formatting for the library-value panels. Unit-tested in
 * src/test/library-value-format.test.ts.
 */

const BYTES_PER_KIB = 1024;
const BYTES_PER_MB = BYTES_PER_KIB ** 2;
const BYTES_PER_GB = BYTES_PER_KIB ** 3;
const BYTES_PER_TB = BYTES_PER_KIB ** 4;
/** Below 10 units one decimal still carries information ("4.7 GB"); above it it's noise. */
const DECIMAL_BELOW = 10;

const MS_PER_HOUR = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30.44;
const DAYS_PER_YEAR = 365.25;
/** Under ~2 months, whole days read best; under 2 years, months. */
const DAYS_LIMIT = 60;
const MONTHS_LIMIT = 24;

const withUnit = (value: number, unit: string) =>
    `${value < DECIMAL_BELOW ? value.toFixed(1) : Math.round(value).toLocaleString("en-US")} ${unit}`;

/** Binary units, labelled the way file managers and Plex do: "812 MB", "4.7 GB", "1.3 TB". */
export const formatBytes = (bytes: number): string => {
    if (bytes >= BYTES_PER_TB) return withUnit(bytes / BYTES_PER_TB, "TB");
    if (bytes >= BYTES_PER_GB) return withUnit(bytes / BYTES_PER_GB, "GB");
    return `${Math.round(bytes / BYTES_PER_MB).toLocaleString("en-US")} MB`;
};

/** Human-scale duration: "5h", "12 days", "8 mo", "3.4 years". */
export const formatDelay = (ms: number): string => {
    const hours = Math.max(0, ms) / MS_PER_HOUR;
    if (hours < HOURS_PER_DAY) return `${Math.max(1, Math.round(hours))}h`;
    const days = hours / HOURS_PER_DAY;
    if (days < DAYS_LIMIT) {
        const rounded = Math.round(days);
        return `${rounded} ${rounded === 1 ? "day" : "days"}`;
    }
    const months = days / DAYS_PER_MONTH;
    if (months < MONTHS_LIMIT) return `${Math.round(months)} mo`;
    return `${(days / DAYS_PER_YEAR).toFixed(1)} years`;
};

const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };

export const formatMonthYear = (epochMs: number): string =>
    new Date(epochMs).toLocaleDateString("en-US", MONTH_YEAR);

export const FIRST_PLAY_BUCKET_LABELS: Record<FirstPlayBucketKey, string> = {
    sameDay: "Same day",
    week: "Within a week",
    month: "Within a month",
    later: "Later",
    never: "Never played",
};

export const titleWithYear = (title: string, year: number | null): string =>
    year ? `${title} (${year})` : title;

/** "Never played" or "Last played 14 mo ago" for a dead-weight row. */
export const lastPlayedLabel = (lastPlayed: number | null, now: number): string =>
    lastPlayed === null ? "Never played" : `Last played ${formatDelay(now - lastPlayed)} ago`;
