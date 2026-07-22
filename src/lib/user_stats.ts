import { db } from "./db";
import { HistoryEntry } from "./history";
import { findIdentityByName } from "./identity";
import { scopeFilter } from "./stats/scope";
import { calculateStreaks, type StreakResult } from "./stats/streaks";

export type UserStats = {
    /** Canonical identity the stats were resolved to — used by per-user graph queries. */
    accountId: string;
    global: {
        last24h: { count: number; duration: number };
        last7d: { count: number; duration: number };
        last30d: { count: number; duration: number };
        last365d: { count: number; duration: number };
        allTime: { count: number; duration: number };
    };
    streaks: StreakResult;
    platforms: { platform: string; count: number }[];
    players: { player: string; count: number }[];
    recentlyPlayed: HistoryEntry[];
};

// Projection for the period/all-time aggregate queries below. SUM() returns NULL
// when no rows match (call sites coalesce with `|| 0`), so duration is nullable.
interface PeriodStatsRow {
    count: number;
    duration: number | null;
}

type StatsParams = { accountId: string; allowedServerIds?: string[] };

// Watch time is pause-free playback (v5 fact column), wallclock fallback for
// pre-fact rows — consistent with home-stats durations.
const getStatsForPeriod = ({ accountId, allowedServerIds }: StatsParams, since: number) => {
    const scope = scopeFilter("serverId", allowedServerIds);
    return db.prepare(`
        SELECT COUNT(*) as count, SUM(COALESCE(play_duration, duration)) as duration
        FROM activity_history
        WHERE userId = ? AND stopTime > ?${scope.sql}
    `).get(accountId, since, ...scope.args) as PeriodStatsRow | undefined;
};

// All-time totals come from the materialized user_activity_summary table —
// one row per (accountId, serverId); SUM() merges the user's (in-scope)
// servers. NOTE: summary durations are wallclock-built (pre-fact) — a known
// caveat until the summary is rebuilt on play_duration.
const getAllTimeStats = ({ accountId, allowedServerIds }: StatsParams) => {
    const scope = scopeFilter("serverId", allowedServerIds);
    return db.prepare(`
        SELECT
          COALESCE(SUM(total_count), 0) as count,
          COALESCE(SUM(total_duration), 0) as duration
        FROM user_activity_summary
        WHERE accountId = ?${scope.sql}
    `).get(accountId, ...scope.args) as PeriodStatsRow | undefined;
};

const getPlatformStats = ({ accountId, allowedServerIds }: StatsParams) => {
    const scope = scopeFilter("serverId", allowedServerIds);
    return db.prepare(`
        SELECT platform, COUNT(*) as count
        FROM activity_history
        WHERE userId = ? AND platform IS NOT NULL${scope.sql}
        GROUP BY platform
        ORDER BY count DESC
    `).all(accountId, ...scope.args);
};

// Reads the promoted `player` column instead of evaluating json_extract per
// row, so the (userId, stopTime) index can serve the WHERE.
const getPlayerStats = ({ accountId, allowedServerIds }: StatsParams) => {
    const scope = scopeFilter("serverId", allowedServerIds);
    return db.prepare(`
        SELECT player, COUNT(*) as count
        FROM activity_history
        WHERE userId = ? AND player IS NOT NULL${scope.sql}
        GROUP BY player
        ORDER BY count DESC
    `).all(accountId, ...scope.args);
};

const getRecentlyPlayed = ({ accountId, allowedServerIds }: StatsParams) => {
    const scope = scopeFilter("h.serverId", allowedServerIds);
    return db.prepare(`
        SELECT h.*, s.name as serverName
        FROM activity_history h
        LEFT JOIN servers s ON h.serverId = s.id
        WHERE h.userId = ?${scope.sql}
        ORDER BY h.stopTime DESC
        LIMIT 20
    `).all(accountId, ...scope.args);
};

export const getUserStats = (username: string, allowedServerIds?: string[]): UserStats => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Resolve to the canonical identity. `username` may be a username, a
    // display title, or already an accountId — legacy identities keep the
    // original name as both username and title, so they resolve here too.
    const identity = findIdentityByName(username);
    const accountId = identity ? identity.accountId : username;

    const params: StatsParams = { accountId, allowedServerIds };

    const stats24h = getStatsForPeriod(params, now - oneDay);
    const stats7d = getStatsForPeriod(params, now - (7 * oneDay));
    const stats30d = getStatsForPeriod(params, now - (30 * oneDay));
    const stats1y = getStatsForPeriod(params, now - (365 * oneDay));
    const statsAll = getAllTimeStats(params);

    const platforms = getPlatformStats(params) as { platform: string; count: number }[];
    const players = getPlayerStats(params) as { player: string; count: number }[];
    const recentlyPlayed = (getRecentlyPlayed(params) as HistoryEntry[]).map(entry => {
        let thumb = undefined;
        let parentThumb = undefined;
        if (entry.meta_json) {
            try {
                const meta = JSON.parse(entry.meta_json);
                thumb = meta.thumb;
                parentThumb = meta.parentThumb;
            } catch (e) {
                // ignore json error
            }
        }
        return {
            ...entry,
            thumb,
            parentThumb
        };
    });

    const streaks = calculateStreaks({ accountId, allowedServerIds });

    return {
        accountId,
        global: {
            last24h: { count: stats24h?.count || 0, duration: stats24h?.duration || 0 },
            last7d: { count: stats7d?.count || 0, duration: stats7d?.duration || 0 },
            last30d: { count: stats30d?.count || 0, duration: stats30d?.duration || 0 },
            last365d: { count: stats1y?.count || 0, duration: stats1y?.duration || 0 },
            allTime: { count: statsAll?.count || 0, duration: statsAll?.duration || 0 },
        },
        streaks,
        platforms,
        players: players.map(p => ({ player: p.player || "Unknown", count: p.count })),
        recentlyPlayed,
    };
};
