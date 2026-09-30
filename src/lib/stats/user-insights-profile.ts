import { db } from "../db";
import { getTopGenres, type GenreStat } from "./user-insights-genres";
import { buildServerFilter, buildWindowFilter, type PeopleScope, type PersonRef } from "./user-insights-shared";

/**
 * Per-user viewing profile for the window: when they watch (hour of day,
 * weekday vs weekend), on what, how far they get, and which genres. Reusable
 * outside the stats page (e.g. user detail) — everything is one accountId.
 */

export const HOURS_PER_DAY = 24;
const DEFAULT_TOP_LIMIT = 5;
const DEFAULT_PICKER_LIMIT = 50;
const MAX_PERCENT = 100;
/** SQLite strftime('%w'): 0 = Sunday, 6 = Saturday. */
const WEEKEND_DAYS_SQL = "('0','6')";

export type NamedCount = { name: string; plays: number };

export type UserProfile = PersonRef & {
    plays: number;
    seconds: number;
    /** Plays per local hour of day, index 0-23. */
    hours: number[];
    weekdayPlays: number;
    weekendPlays: number;
    /** 0-1 share of plays on Saturday/Sunday; null without plays. */
    weekendShare: number | null;
    topPlatforms: NamedCount[];
    topDevices: NamedCount[];
    /** Mean percent_complete (0-100) of plays with a known position; null if none. */
    averageCompletion: number | null;
    topGenres: GenreStat[];
};

export type UserProfileParams = PeopleScope & { accountId: string; limit?: number };

type Totals = {
    plays: number;
    seconds: number | null;
    weekendPlays: number | null;
    averageCompletion: number | null;
};

/** Null unless the account has history inside the viewer's server scope — no name leaks across scopes. */
const fetchPerson = (params: UserProfileParams): PersonRef | null => {
    const { conditions, args } = buildServerFilter(params);
    const latest = db.prepare(`
        SELECT h.user AS name FROM activity_history h
        WHERE ${["h.userId = ?", ...conditions].join(" AND ")}
        ORDER BY h.startTime DESC LIMIT 1
    `).get(params.accountId, ...args) as { name: string } | undefined;
    if (!latest) return null;
    const identity = db.prepare("SELECT title, thumb FROM user_identities WHERE accountId = ?")
        .get(params.accountId) as { title: string; thumb: string | null } | undefined;
    return { accountId: params.accountId, user: identity?.title ?? latest.name, thumb: identity?.thumb ?? null };
};

const topBy = (column: "h.platform" | "h.device", where: string, args: (string | number)[], limit: number) =>
    db.prepare(`
        SELECT ${column} AS name, COUNT(*) AS plays
        FROM activity_history h
        WHERE ${where} AND ${column} IS NOT NULL AND ${column} != ''
        GROUP BY ${column}
        ORDER BY plays DESC, name ASC
        LIMIT ?
    `).all(...args, limit) as NamedCount[];

/** Profile for one account, or null when the account is unknown in scope. */
export const getUserProfile = (params: UserProfileParams): UserProfile | null => {
    const person = fetchPerson(params);
    if (!person) return null;
    const limit = params.limit ?? DEFAULT_TOP_LIMIT;
    const { where, args } = buildWindowFilter({ ...params, userId: params.accountId });

    const totals = db.prepare(`
        SELECT COUNT(*) AS plays,
               SUM(COALESCE(h.play_duration, h.duration, 0)) AS seconds,
               SUM(CASE WHEN strftime('%w', h.startTime / 1000, 'unixepoch', 'localtime') IN ${WEEKEND_DAYS_SQL}
                        THEN 1 ELSE 0 END) AS weekendPlays,
               AVG(MIN(h.percent_complete, ${MAX_PERCENT})) AS averageCompletion
        FROM activity_history h
        WHERE ${where}
    `).get(...args) as Totals;

    const hourRows = db.prepare(`
        SELECT CAST(strftime('%H', h.startTime / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
               COUNT(*) AS plays
        FROM activity_history h
        WHERE ${where}
        GROUP BY hour
    `).all(...args) as { hour: number; plays: number }[];
    const hours = Array.from({ length: HOURS_PER_DAY }, () => 0);
    for (const row of hourRows) hours[row.hour] = row.plays;

    const weekendPlays = totals.weekendPlays ?? 0;
    return {
        ...person,
        plays: totals.plays,
        seconds: totals.seconds ?? 0,
        hours,
        weekdayPlays: totals.plays - weekendPlays,
        weekendPlays,
        weekendShare: totals.plays > 0 ? weekendPlays / totals.plays : null,
        topPlatforms: topBy("h.platform", where, args, limit),
        topDevices: topBy("h.device", where, args, limit),
        averageCompletion:
            totals.averageCompletion === null ? null : Math.round(totals.averageCompletion),
        topGenres: getTopGenres({ ...params, userId: params.accountId, limit }),
    };
};

export type ProfileUserOption = PersonRef & { plays: number };

/** Users with plays in the window, most active first — the profile picker's options. */
export const listProfileUsers = (params: PeopleScope & { limit?: number }): ProfileUserOption[] => {
    const { where, args } = buildWindowFilter(params);
    return db.prepare(`
        SELECT h.userId AS accountId, COALESCE(ui.title, MAX(h.user)) AS user, ui.thumb AS thumb,
               COUNT(*) AS plays
        FROM activity_history h
        LEFT JOIN user_identities ui ON ui.accountId = h.userId
        WHERE ${where} AND h.userId IS NOT NULL
        GROUP BY h.userId
        ORDER BY plays DESC, user ASC
        LIMIT ?
    `).all(...args, params.limit ?? DEFAULT_PICKER_LIMIT) as ProfileUserOption[];
};
