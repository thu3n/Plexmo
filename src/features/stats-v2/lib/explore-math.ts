/**
 * Pure helpers for the Statistics v2 drill-down features (compare overlay,
 * calendar heatmap, title page). Unit-tested in src/test/title-detail-explore-math.test.ts.
 */

const DAYS_PER_WEEK = 7;
/** Months are only used above a year; a mean month keeps the shift within a bucket. */
const AVG_DAYS_PER_MONTH = 30.44;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local-date key in the same "YYYY-MM-DD" form as the plays_by_day buckets. */
export const toDayKey = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * Moves a "YYYY-MM-DD" / "YYYY-MM" bucket forward by `days`, so a previous-
 * window bucket lands on the current-window bucket it compares against.
 */
export const shiftBucket = (bucket: string, days: number): string => {
    const [y, m, d] = bucket.split("-").map(Number);
    if (!y || !m) return bucket;
    if (d) return toDayKey(new Date(y, m - 1, d + days));
    const shifted = new Date(y, m - 1 + Math.round(days / AVG_DAYS_PER_MONTH), 1);
    return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}`;
};

export type ComparePoint = { bucket: string; value: number; previous?: number };

/**
 * Current series with the previous window overlaid on the same x positions.
 * Buckets present in only one window still appear (the other side reads 0),
 * so a quiet day in the current window can't hide last period's spike.
 */
export const mergeCompareSeries = (
    current: { bucket: string; value: number }[],
    previous: { bucket: string; value: number }[],
    days: number,
): ComparePoint[] => {
    const merged = new Map<string, ComparePoint>();
    for (const point of current) merged.set(point.bucket, { bucket: point.bucket, value: point.value, previous: 0 });
    const earliest = current[0]?.bucket;
    for (const point of previous) {
        const bucket = shiftBucket(point.bucket, days);
        // Shifted buckets before the current series' first point fall outside the chart.
        if (earliest && bucket < earliest) continue;
        const existing = merged.get(bucket);
        if (existing) existing.previous = (existing.previous ?? 0) + point.value;
        else merged.set(bucket, { bucket, value: 0, previous: point.value });
    }
    return [...merged.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
};

export type CalendarCell = { date: string; value: number; inRange: boolean };

export type CalendarGrid = {
    /** Columns of 7 cells, Monday first (the ActivityHeatmap row order). */
    weeks: CalendarCell[][];
    /** Month label per week column, set on the first column of each month. */
    monthLabels: (string | null)[];
};

/** Month labels are ~3 cells wide at the calendar's cell size. */
const MIN_LABEL_GAP_WEEKS = 3;

/** Monday = 0 .. Sunday = 6. */
const mondayIndex = (date: Date) => (date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;

/**
 * GitHub-style year grid ending on `end` (inclusive), `dayCount` days back.
 * Leading/trailing padding cells keep full weeks and are marked !inRange.
 */
export const buildCalendarGrid = (
    rows: { bucket: string; total: number }[],
    end: Date,
    dayCount: number,
): CalendarGrid => {
    const values = new Map(rows.map((r) => [r.bucket, r.total]));
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const first = new Date(last.getFullYear(), last.getMonth(), last.getDate() - (dayCount - 1));
    const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayIndex(first));

    const weeks: CalendarCell[][] = [];
    const monthLabels: (string | null)[] = [];
    let lastMonth = -1;
    for (let cursor = gridStart; cursor <= last; ) {
        const week: CalendarCell[] = [];
        let label: string | null = null;
        for (let i = 0; i < DAYS_PER_WEEK; i++) {
            const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
            const inRange = day >= first && day <= last;
            const date = toDayKey(day);
            week.push({ date, value: inRange ? (values.get(date) ?? 0) : 0, inRange });
            if (inRange && day.getMonth() !== lastMonth) {
                lastMonth = day.getMonth();
                label = day.toLocaleDateString("en-US", { month: "short" });
            }
        }
        // A label closer than MIN_LABEL_GAP_WEEKS to the previous one would overlap it;
        // the earlier (partial) month gives way, as on GitHub.
        const previous = monthLabels.findLastIndex((l) => l !== null);
        if (label && previous >= 0 && weeks.length - previous < MIN_LABEL_GAP_WEEKS) monthLabels[previous] = null;
        weeks.push(week);
        monthLabels.push(label);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + DAYS_PER_WEEK);
    }
    return { weeks, monthLabels };
};

/** Shift (days) of the previous window, or null when there is none to compare ("All time"). */
export const compareOffsetDays = (days: number, allTimeDays: number): number | null =>
    days >= allTimeDays ? null : days;

/** The title drill-down page for a canonical media id (movie, show or episode). */
export const titleHref = (mediaId: number): string => `/statistics/title/${mediaId}`;

const TYPE_LABEL: Record<"movie" | "show" | "episode", string> = { movie: "Movie", show: "Show", episode: "Episode" };

/** "Movie · 2019", "Show · 2008", "Episode · S2E5 · Breaking Bad". */
export const formatTitleMeta = (title: {
    type: "movie" | "show" | "episode";
    year: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    showTitle: string | null;
}): string => {
    const parts = [TYPE_LABEL[title.type]];
    if (title.type === "episode") {
        parts.push(`S${title.seasonNumber ?? "?"}E${title.episodeNumber ?? "?"}`);
        if (title.showTitle) parts.push(title.showTitle);
    } else if (title.year) {
        parts.push(String(title.year));
    }
    return parts.join(" · ");
};

/** "87%" or an em dash when completion was never reported. */
export const formatCompletion = (percent: number | null): string => (percent === null ? "—" : `${Math.round(percent)}%`);

export type SeasonGroup<T> = { season: number | null; episodes: T[] };

/** Episodes grouped by season in first-seen order (the API already sorts season, episode). */
export const groupBySeason = <T extends { seasonNumber: number | null }>(episodes: T[]): SeasonGroup<T>[] => {
    const groups: SeasonGroup<T>[] = [];
    for (const episode of episodes) {
        const last = groups[groups.length - 1];
        if (last && last.season === episode.seasonNumber) last.episodes.push(episode);
        else groups.push({ season: episode.seasonNumber, episodes: [episode] });
    }
    return groups;
};
