import { db } from "../db";
import { ONE_DAY_MS, buildServerFilter, type PeopleScope, type PersonRef } from "./user-insights-shared";

/**
 * User lifecycle per calendar month (local time, like every other stats
 * bucket):
 * - active:    played at least once that month
 * - new:       first play EVER (within the viewer's server scope) was that month
 * - returning: active but not new — had played in some earlier month
 * - dormant:   had played before, but nothing in the DORMANT_DAYS before the
 *              month's end (or `until` for the running month)
 * Firstness needs the whole history, so the aggregation ignores the window
 * start and only the emitted months are clipped to it. Bounded by
 * users x active months, not by history size.
 */

export const DORMANT_DAYS = 60;
const DEFAULT_DORMANT_LIMIT = 50;

export type LifecycleMonth = {
    /** "YYYY-MM" (local time). */
    month: string;
    active: number;
    new: number;
    returning: number;
    dormant: number;
};

export type DormantUser = PersonRef & {
    plays: number;
    firstPlayed: number;
    lastPlayed: number;
    daysSinceLastPlay: number;
};

export type UserLifecycle = {
    dormantDays: number;
    months: LifecycleMonth[];
    /** Current dormant users, longest-silent first — candidates for removing shares. */
    dormantUsers: DormantUser[];
    dormantTotal: number;
};

export type UserLifecycleParams = PeopleScope & { dormantLimit?: number };

type UserMonthRow = { accountId: string; month: string; lastPlay: number };

const monthKey = (time: number): string => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthStart = (key: string): number => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).getTime();
};

const nextMonthStart = (key: string): number => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month, 1).getTime();
};

const monthsBetween = (firstKey: string, lastKey: string): string[] => {
    const keys: string[] = [];
    for (let t = monthStart(firstKey); t <= monthStart(lastKey); t = nextMonthStart(monthKey(t))) {
        keys.push(monthKey(t));
    }
    return keys;
};

const fetchUserMonths = (scope: PeopleScope, until: number): UserMonthRow[] => {
    const { conditions, args } = buildServerFilter(scope);
    const where = ["h.userId IS NOT NULL", "h.startTime < ?", ...conditions].join(" AND ");
    return db.prepare(`
        SELECT h.userId AS accountId,
               strftime('%Y-%m', h.startTime / 1000, 'unixepoch', 'localtime') AS month,
               MAX(h.startTime) AS lastPlay
        FROM activity_history h
        WHERE ${where}
        GROUP BY h.userId, month
        ORDER BY h.userId, month
    `).all(until, ...args) as UserMonthRow[];
};

const buildMonthSeries = (rows: UserMonthRow[], since: number, until: number): LifecycleMonth[] => {
    if (rows.length === 0) return [];
    const byUser = new Map<string, UserMonthRow[]>();
    for (const row of rows) {
        const list = byUser.get(row.accountId) ?? [];
        list.push(row);
        byUser.set(row.accountId, list);
    }
    const firstDataMonth = rows.reduce((min, r) => (r.month < min ? r.month : min), rows[0].month);
    const sinceMonth = monthKey(since);
    const startKey = sinceMonth > firstDataMonth ? sinceMonth : firstDataMonth;
    const series = monthsBetween(startKey, monthKey(until - 1)).map((month) => ({
        month, active: 0, new: 0, returning: 0, dormant: 0,
    }));

    const dormantGap = DORMANT_DAYS * ONE_DAY_MS;
    for (const months of byUser.values()) {
        const firstMonth = months[0].month;
        let cursor = 0;
        let lastPlay: number | null = null;
        for (const bucket of series) {
            // Advance through this user's months up to and including the bucket.
            while (cursor < months.length && months[cursor].month <= bucket.month) {
                lastPlay = months[cursor].lastPlay;
                cursor++;
            }
            if (lastPlay === null) continue;
            const activeHere = cursor > 0 && months[cursor - 1].month === bucket.month;
            if (activeHere) {
                bucket.active++;
                if (bucket.month === firstMonth) bucket.new++;
                else bucket.returning++;
            }
            const bucketEnd = Math.min(nextMonthStart(bucket.month), until);
            if (bucketEnd - lastPlay > dormantGap) bucket.dormant++;
        }
    }
    return series;
};

const fetchDormantUsers = (scope: PeopleScope, until: number, limit: number) => {
    const { conditions, args } = buildServerFilter(scope);
    const where = ["h.userId IS NOT NULL", "h.startTime < ?", ...conditions].join(" AND ");
    const cutoff = until - DORMANT_DAYS * ONE_DAY_MS;
    const rows = db.prepare(`
        SELECT h.userId AS accountId,
               COALESCE(ui.title, MAX(h.user)) AS user,
               ui.thumb AS thumb,
               COUNT(*) AS plays,
               MIN(h.startTime) AS firstPlayed,
               MAX(h.startTime) AS lastPlayed
        FROM activity_history h
        LEFT JOIN user_identities ui ON ui.accountId = h.userId
        WHERE ${where}
        GROUP BY h.userId
        HAVING MAX(h.startTime) < ?
        ORDER BY lastPlayed ASC
    `).all(until, ...args, cutoff) as Omit<DormantUser, "daysSinceLastPlay">[];
    return {
        total: rows.length,
        users: rows.slice(0, limit).map((row) => ({
            ...row,
            daysSinceLastPlay: Math.floor((until - row.lastPlayed) / ONE_DAY_MS),
        })),
    };
};

export const getUserLifecycle = (params: UserLifecycleParams): UserLifecycle => {
    const until = params.until ?? Date.now();
    const scope = { ...params, until };
    const dormant = fetchDormantUsers(scope, until, params.dormantLimit ?? DEFAULT_DORMANT_LIMIT);
    return {
        dormantDays: DORMANT_DAYS,
        months: buildMonthSeries(fetchUserMonths(scope, until), params.since, until),
        dormantUsers: dormant.users,
        dormantTotal: dormant.total,
    };
};
