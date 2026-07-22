import { db } from "../db";
import { scopeFilter } from "./scope";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";
import { computeStreaksFromDays } from "./streaks";

export type StreakLeaderboardEntry = {
    accountId: string;
    user: string;
    thumb: string | null;
    longest: number;
    current: number;
};

export type StreakLeaderboardParams = {
    serverId?: string;
    allowedServerIds?: string[];
    limit?: number;
    /** Injectable clock for tests. */
    now?: number;
};

const DEFAULT_LIMIT = 10;

/**
 * All-users streak leaderboard: one SQL pass collects every user's qualified
 * days (identical day-qualification semantics to streaks.ts getQualifiedDays,
 * including the future-row guard), then the shared pure streak walk runs per
 * user in JS. Streaks are longitudinal, so no time window applies — only the
 * server scope. Ranking: longest DESC, then current DESC, then name.
 */
export const getTopStreaks = (params: StreakLeaderboardParams): StreakLeaderboardEntry[] => {
    const now = params.now ?? Date.now();
    const scope = scopeFilter("h.serverId", params.allowedServerIds);

    const conditions = ["h.startTime <= ?"];
    const args: (string | number)[] = [now];
    if (params.serverId && params.serverId !== "all") {
        conditions.push("h.serverId = ?");
        args.push(params.serverId);
    }

    const rows = db.prepare(`
        SELECT userId, day FROM (
            SELECT
                h.userId AS userId,
                strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) AS day,
                SUM(COALESCE(h.play_duration, h.duration)) AS play_secs,
                MAX(h.percent_complete) AS best_pct
            FROM activity_history h
            WHERE ${conditions.join(" AND ")}${scope.sql}
            GROUP BY h.userId, day
        )
        WHERE best_pct >= ${MIN_PLAY_PERCENT} OR play_secs >= ${MIN_PLAY_SECONDS_FALLBACK}
        ORDER BY userId, day
    `).all(...args, ...scope.args) as { userId: string; day: string }[];

    const daysByUser = new Map<string, string[]>();
    for (const row of rows) {
        const days = daysByUser.get(row.userId);
        if (days) days.push(row.day);
        else daysByUser.set(row.userId, [row.day]);
    }
    if (daysByUser.size === 0) return [];

    const accountIds = [...daysByUser.keys()];
    const marks = accountIds.map(() => "?").join(",");
    const identities = db.prepare(`
        SELECT accountId, COALESCE(title, username, accountId) as user, thumb
        FROM user_identities WHERE accountId IN (${marks})
    `).all(...accountIds) as { accountId: string; user: string; thumb: string | null }[];
    const identityById = new Map(identities.map((i) => [i.accountId, i]));

    return accountIds
        .map((accountId) => {
            const { current, longest } = computeStreaksFromDays(daysByUser.get(accountId)!, now);
            const identity = identityById.get(accountId);
            return {
                accountId,
                user: identity?.user ?? accountId,
                thumb: identity?.thumb ?? null,
                longest,
                current,
            };
        })
        .sort(
            (a, b) =>
                b.longest - a.longest || b.current - a.current || a.user.localeCompare(b.user)
        )
        .slice(0, params.limit ?? DEFAULT_LIMIT);
};
