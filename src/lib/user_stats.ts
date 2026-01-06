import { db } from "./db";
import { HistoryEntry } from "./history";

export type UserStats = {
    global: {
        last24h: { count: number; duration: number };
        last7d: { count: number; duration: number };
        last30d: { count: number; duration: number };
        allTime: { count: number; duration: number };
    };
    streaks: {
        current: number;
        longest: number;
        currentStreakDates?: string[];
    };
    platforms: { platform: string; count: number }[];
    players: { player: string; count: number }[];
    recentlyPlayed: HistoryEntry[];
};

const getStreakActivity = db.prepare(`
    SELECT 
        strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) as date,
        h.duration as watchedDuration,
        h.meta_json as historyMeta,
        l.meta_json as libraryMeta
    FROM activity_history h
    LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
    WHERE (h.user = @username OR h.userId = @userId)
    ORDER BY h.startTime ASC
`);

const getStatsForPeriod = db.prepare(`
    SELECT COUNT(*) as count, SUM(duration) as duration
    FROM activity_history
    WHERE (user = @username OR userId = @userId) AND stopTime > @since
`);

const getAllTimeStats = db.prepare(`
    SELECT COUNT(*) as count, SUM(duration) as duration
    FROM activity_history
    WHERE (user = @username OR userId = @userId)
`);

const getPlatformStats = db.prepare(`
    SELECT platform, COUNT(*) as count
    FROM activity_history
    WHERE (user = @username OR userId = @userId) AND platform IS NOT NULL
    GROUP BY platform
    ORDER BY count DESC
`);

const getPlayerStats = db.prepare(`
    SELECT json_extract(meta_json, '$.player') as player, COUNT(*) as count
    FROM activity_history
    WHERE (user = @username OR userId = @userId) AND meta_json IS NOT NULL
    GROUP BY player
    ORDER BY count DESC
`);

const getRecentlyPlayed = db.prepare(`
    SELECT h.*, s.name as serverName
    FROM activity_history h
    LEFT JOIN servers s ON h.serverId = s.id
    WHERE h.user = @username OR h.userId = @userId
    ORDER BY h.stopTime DESC
    LIMIT 20
`);

const getStreakFromCache = db.prepare(`SELECT * FROM streak_cache WHERE username = ?`);
const upsertStreakCache = db.prepare(`
    INSERT INTO streak_cache (username, userId, currentStreak, longestStreak, updatedAt)
    VALUES (@username, @userId, @currentStreak, @longestStreak, @updatedAt)
    ON CONFLICT(username) DO UPDATE SET
        userId = excluded.userId,
        currentStreak = excluded.currentStreak,
        longestStreak = excluded.longestStreak,
        updatedAt = excluded.updatedAt
`);

export const calculateStreaks = (params: { username: string; userId: string }) => {
    const activity = getStreakActivity.all(params) as {
        date: string;
        watchedDuration: number;
        historyMeta: string | null;
        libraryMeta: string | null
    }[];

    // Identify valid days (Set to avoid duplicates)
    const validDaysSet = new Set<string>();

    for (const entry of activity) {
        let isValid = false;
        let totalDurationMs = 0;

        // 1. Try to find total duration from History Meta
        if (entry.historyMeta) {
            try {
                const meta = JSON.parse(entry.historyMeta);
                if (meta.duration) totalDurationMs = Number(meta.duration);
            } catch (e) { }
        }

        // 2. Fallback to Library Meta
        if (!totalDurationMs && entry.libraryMeta) {
            try {
                const meta = JSON.parse(entry.libraryMeta);
                if (meta.duration) totalDurationMs = Number(meta.duration);
            } catch (e) { }
        }

        // 3. Check Percentage (watchedDuration is in seconds, totalDurationMs is in ms)
        if (totalDurationMs > 0) {
            const watchedMs = entry.watchedDuration * 1000;
            const percentage = watchedMs / totalDurationMs;
            if (percentage >= 0.20) {
                isValid = true;
            }
        } else {
            // 4. Fallback: Fixed 10 minutes (600 seconds)
            if (entry.watchedDuration >= 600) {
                isValid = true;
            }
        }

        if (isValid) {
            validDaysSet.add(entry.date);
        }
    }

    const validDays = Array.from(validDaysSet).sort();

    if (validDays.length === 0) {
        return { current: 0, longest: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    // Helper to check if dates are consecutive (difference of 1 day)
    const isConsecutive = (d1: Date, d2: Date) => {
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
    };

    // Iterate through valid days to find streaks
    for (let i = 0; i < validDays.length; i++) {
        const currentDate = new Date(validDays[i]);

        if (lastDate === null) {
            // First day of a streak
            tempStreak = 1;
        } else {
            if (isConsecutive(lastDate, currentDate)) {
                // Continue streak
                tempStreak++;
            } else {
                // Streak broken
                if (tempStreak > longestStreak) {
                    longestStreak = tempStreak;
                }
                tempStreak = 1;
            }
        }
        lastDate = currentDate;
    }

    // Final check for longest streak
    if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
    }

    // Check if the streak is "current"
    // Current means the last valid day was Today or Yesterday
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastValidDayStr = validDays[validDays.length - 1];

    // Normalize to YYYY-MM-DD (Local)
    const toLocalYMD = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().split('T')[0];
    };

    const todayStr = toLocalYMD(new Date());
    const yesterdayStr = toLocalYMD(yesterday);

    if (lastValidDayStr === todayStr || lastValidDayStr === yesterdayStr) {
        currentStreak = tempStreak;
    } else {
        currentStreak = 0;
    }

    // Collect dates for the current streak if active
    let currentStreakDates: string[] = [];
    if (currentStreak > 0) {
        const potentialStreakDates = validDays.slice(-currentStreak);
        currentStreakDates = potentialStreakDates;
    }

    return { current: currentStreak, longest: longestStreak, currentStreakDates };
};

export const getCachedStreaks = (params: { username: string; userId: string }) => {
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    // 1. Check Cache
    const cached = getStreakFromCache.get(params.username) as {
        currentStreak: number;
        longestStreak: number;
        updatedAt: number;
        userId?: string;
    } | undefined;

    if (cached && (now - cached.updatedAt < CACHE_TTL)) {
        return {
            current: cached.currentStreak,
            longest: cached.longestStreak,
            fromCache: true
        };
    }

    // 2. Calculate Fresh
    const fresh = calculateStreaks(params);

    // 3. Update Cache
    try {
        upsertStreakCache.run({
            username: params.username,
            userId: params.userId,
            currentStreak: fresh.current,
            longestStreak: fresh.longest,
            updatedAt: now
        });
    } catch (error) {
        console.error("Failed to update streak cache", error);
    }

    return {
        ...fresh,
        fromCache: false
    };
};

export const getUserStats = (username: string): UserStats => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Resolve user to find ID and Title variants
    // searchParams usually has 'username', but history saves 'title' (Display Name).
    // linking them via the 'users' table is best.

    // Check if we have a user with this username
    const userMatch = db.prepare("SELECT * FROM users WHERE username = ? OR title = ?").get(username, username) as any;

    const userId = userMatch ? userMatch.id : "NO_MATCH_ID";
    // If we matched a user, we use their current Display Name as the primary "user" param for fallback, 
    // but the SQL ORs it with userId so we catch both.
    // If no match, we use the passed username as the only hope.
    const queryName = userMatch ? userMatch.title : username;

    const params = { username: queryName, userId };
    const since24h = { ...params, since: now - oneDay };
    const since7d = { ...params, since: now - (7 * oneDay) };
    const since30d = { ...params, since: now - (30 * oneDay) };

    const stats24h = getStatsForPeriod.get(since24h) as any;
    const stats7d = getStatsForPeriod.get(since7d) as any;
    const stats30d = getStatsForPeriod.get(since30d) as any;
    const statsAll = getAllTimeStats.get(params) as any;

    const platforms = getPlatformStats.all(params) as { platform: string; count: number }[];
    const players = getPlayerStats.all(params) as { player: string; count: number }[];
    const recentlyPlayed = (getRecentlyPlayed.all(params) as HistoryEntry[]).map(entry => {
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

    const streaks = calculateStreaks(params);

    return {
        global: {
            last24h: { count: stats24h.count || 0, duration: stats24h.duration || 0 },
            last7d: { count: stats7d.count || 0, duration: stats7d.duration || 0 },
            last30d: { count: stats30d.count || 0, duration: stats30d.duration || 0 },
            allTime: { count: statsAll.count || 0, duration: statsAll.duration || 0 },
        },
        streaks,
        platforms,
        players: players.map(p => ({ player: p.player || "Unknown", count: p.count })),
        recentlyPlayed,
    };
};
