import { db } from "../db";
import { scopeFilter } from "./scope";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StreakParams = {
    accountId: string;
    allowedServerIds?: string[];
    /** Injectable clock for tests. */
    now?: number;
};

export type StreakResult = { current: number; longest: number };

/**
 * Qualified days in ONE SQL pass, aggregated per local calendar day over the
 * v5 fact columns. A day counts when the summed pause-free playback reaches
 * the fallback threshold OR any row got >= MIN_PLAY_PERCENT into its runtime.
 *
 * Per-day SUM means three sub-threshold fragments of one evening still count
 * (the old per-row test dropped them). A session resumed after midnight
 * credits both days — playback genuinely happened on both, so that is the
 * documented behavior, not a bug. NULL percent_complete (pre-v5 rows) is
 * falsy in SQLite and falls through to the playback-sum branch. The startTime
 * guard keeps future-dated rows (bad imports/clock skew) from ever becoming
 * "last valid day" and silently zeroing the current streak.
 */
const getQualifiedDays = ({ accountId, allowedServerIds, now }: StreakParams): string[] => {
    const scope = scopeFilter("serverId", allowedServerIds);
    const rows = db
        .prepare(
            `
        SELECT day FROM (
            SELECT
                strftime('%Y-%m-%d', datetime(startTime / 1000, 'unixepoch', 'localtime')) AS day,
                SUM(COALESCE(play_duration, duration)) AS play_secs,
                MAX(percent_complete) AS best_pct
            FROM activity_history
            WHERE userId = ? AND startTime <= ?${scope.sql}
            GROUP BY day
        )
        WHERE best_pct >= ${MIN_PLAY_PERCENT} OR play_secs >= ${MIN_PLAY_SECONDS_FALLBACK}
        ORDER BY day
    `
        )
        .all(accountId, now ?? Date.now(), ...scope.args) as { day: string }[];
    return rows.map((r) => r.day);
};

/** Local YYYY-MM-DD for the today/yesterday comparison. */
const toLocalYMD = (d: Date): string => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
};

// "YYYY-MM-DD" strings parse as UTC midnight, so diffs are exact multiples of
// 24h regardless of DST transitions in the local calendar.
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

/**
 * Pure streak walk over sorted "YYYY-MM-DD" qualified days. Shared by the
 * single-user calculation and the all-users leaderboard.
 */
export const computeStreaksFromDays = (days: string[], now: number): StreakResult => {
    if (days.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
        run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1;
        if (run > longest) longest = run;
    }

    // Current streak survives a grace day: alive while the last valid day is
    // today or yesterday (unchanged semantics from the old implementation).
    const todayStr = toLocalYMD(new Date(now));
    const yesterdayStr = toLocalYMD(new Date(now - DAY_MS));
    const last = days[days.length - 1];
    const current = last === todayStr || last === yesterdayStr ? run : 0;

    return { current, longest };
};

export const calculateStreaks = (params: StreakParams): StreakResult =>
    computeStreaksFromDays(getQualifiedDays(params), params.now ?? Date.now());
