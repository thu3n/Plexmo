import { db } from "../db";
import { buildFilter, type HomeStatsParams } from "./home-stats";
import { getAllTimePeak, getWindowPeak } from "./concurrent";

/**
 * Overview-tab summary tiles: raw totals over the window. totalPlays is a
 * stream-start count (COUNT(*), matching getTopUsers/getTopPlatforms), not
 * the qualified-play dedupe the top-media lists use — the card literally says
 * "streams started". Durations are pause-free with wallclock fallback, never
 * user_activity_summary (its totals are wallclock-built, see user_stats.ts).
 */

export type PlaysByType = { type: "movie" | "episode" | "other"; plays: number };

export type OverviewSummary = {
    totalPlays: number;
    totalSeconds: number;
    uniqueUsers: number;
    playsByType: PlaysByType[];
};

export type OverviewSummaryParams = Omit<HomeStatsParams, "limit" | "userId" | "orderBy">;

export const getOverviewSummary = (params: OverviewSummaryParams): OverviewSummary => {
    const { where, args } = buildFilter(params);

    const totals = db.prepare(`
        SELECT
            COUNT(*) as totalPlays,
            COALESCE(SUM(COALESCE(h.play_duration, h.duration)), 0) as totalSeconds,
            COUNT(DISTINCT h.userId) as uniqueUsers
        FROM activity_history h
        WHERE ${where}
    `).get(...args) as { totalPlays: number; totalSeconds: number; uniqueUsers: number };

    const playsByType = db.prepare(`
        SELECT
            CASE WHEN m.type IN ('movie', 'episode') THEN m.type ELSE 'other' END as type,
            COUNT(*) as plays
        FROM activity_history h
        LEFT JOIN media_items m ON h.mediaId = m.id
        WHERE ${where}
        GROUP BY 1
        ORDER BY plays DESC
    `).all(...args) as PlaysByType[];

    return { ...totals, playsByType };
};

// 20 years — predates Plex itself, so the max window is effectively all time.
export const SUMMARY_MAX_DAYS = 7300;

export type OverviewSummaryWithPeaks = OverviewSummary & {
    days: number;
    peak: {
        window: ReturnType<typeof getWindowPeak>;
        allTime: ReturnType<typeof getAllTimePeak>;
    };
};

/** The full summary-route payload — shared by the route and the cron prewarm. */
export const getOverviewSummaryWithPeaks = (
    params: OverviewSummaryParams,
    days: number,
): OverviewSummaryWithPeaks => {
    const summary = getOverviewSummary(params);
    const peakScope = { serverId: params.serverId, allowedServerIds: params.allowedServerIds };
    const allTime = getAllTimePeak(peakScope);
    // A 7300d window over retention-pruned snapshots would silently lie —
    // "all time" answers from the persistent peak record instead.
    const window = days >= SUMMARY_MAX_DAYS ? allTime : getWindowPeak(peakScope, params.since);
    return { days, ...summary, peak: { window, allTime } };
};
