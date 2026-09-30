import { db } from "../db";
import { scopeFilter } from "./scope";

/**
 * Who and when for Wrapped: the viewer's rank among everyone in scope, the
 * years a user has history in, and (owners only, enforced by the route) the
 * people who can be picked for a given year.
 */

const SECONDS = "COALESCE(h.play_duration, h.duration)";
const MAX_PICKER_USERS = 500;

export type WrappedRank = { position: number; of: number };
export type WrappedPerson = { userId: string; name: string; seconds: number };

type SecondsRow = { userId: string; seconds: number };

/** 1-based position by watch time among users with history in the window. */
export const getWrappedRank = (
    userId: string,
    since: number,
    until: number,
    allowedServerIds?: string[],
): WrappedRank | null => {
    const scope = scopeFilter("h.serverId", allowedServerIds);
    const rows = db.prepare(`
        SELECT h.userId AS userId, SUM(${SECONDS}) AS seconds
        FROM activity_history h
        WHERE h.startTime >= ? AND h.startTime < ? AND h.userId IS NOT NULL${scope.sql}
        GROUP BY h.userId
        ORDER BY seconds DESC
    `).all(since, until, ...scope.args) as SecondsRow[];
    const index = rows.findIndex((r) => r.userId === userId);
    return index === -1 ? null : { position: index + 1, of: rows.length };
};

/** Calendar years (local time) with at least one play, newest first. */
export const getWrappedYears = (userId: string, allowedServerIds?: string[]): number[] => {
    const scope = scopeFilter("h.serverId", allowedServerIds);
    const rows = db.prepare(`
        SELECT DISTINCT CAST(strftime('%Y', h.startTime / 1000, 'unixepoch', 'localtime') AS INTEGER) AS year
        FROM activity_history h
        WHERE h.userId = ?${scope.sql}
        ORDER BY year DESC
    `).all(userId, ...scope.args) as { year: number }[];
    return rows.map((r) => r.year);
};

/** Users with history in the window, most watch time first — the owner's picker. */
export const getWrappedPeople = (since: number, until: number, allowedServerIds?: string[]): WrappedPerson[] => {
    const scope = scopeFilter("h.serverId", allowedServerIds);
    return db.prepare(`
        SELECT h.userId AS userId, COALESCE(ui.title, MAX(h.user)) AS name, SUM(${SECONDS}) AS seconds
        FROM activity_history h
        LEFT JOIN user_identities ui ON ui.accountId = h.userId
        WHERE h.startTime >= ? AND h.startTime < ? AND h.userId IS NOT NULL${scope.sql}
        GROUP BY h.userId
        ORDER BY seconds DESC
        LIMIT ?
    `).all(since, until, ...scope.args, MAX_PICKER_USERS) as WrappedPerson[];
};
