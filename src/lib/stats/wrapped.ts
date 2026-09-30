import { db } from "../db";
import { buildFilter, getTopMovies, getTopShows } from "./home-stats";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";
import { findLongestBinge, type Binge, type BingeRow } from "./wrapped-binge";
import { getWrappedGenres, type WrappedGenre } from "./wrapped-genres";
import { getWrappedRank, type WrappedRank } from "./wrapped-people";

/**
 * Plexmo Wrapped: one user's year in review. Watch time counts every row
 * (time spent is real even for a restart); play counts and "top" rankings use
 * the same qualified-play gate as the top-media stats, so Wrapped and the
 * statistics page never disagree about what a play is. Buckets are local time.
 */

const TOP_TITLES = 5;
const TOP_DEVICES = 5;
const HOURS_PER_DAY = 24;
const MONTHS_PER_YEAR = 12;

const QUALIFIED = `(h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK}))`;
const SECONDS = "COALESCE(h.play_duration, h.duration)";
const LOCAL = (fmt: string) => `strftime('${fmt}', h.startTime / 1000, 'unixepoch', 'localtime')`;
/** One play per title per day — the same (item, day) dedupe as the stats page. */
const PLAY_KEY = `COALESCE(CAST(h.mediaId AS TEXT), h.serverId || ':' || h.ratingKey) || ':' || ${LOCAL("%Y-%m-%d")}`;

export type WrappedTitle = {
    mediaId: number;
    title: string;
    year: number | null;
    plays: number;
    seconds: number;
    thumb: ThumbRef | null;
};

export type WrappedData = {
    userId: string;
    userName: string;
    year: number;
    totals: { plays: number; seconds: number; activeDays: number; titles: number };
    topMovies: WrappedTitle[];
    topShows: WrappedTitle[];
    longestBinge: (Binge & { thumb: ThumbRef | null }) | null;
    busiestDay: { date: string; seconds: number; plays: number } | null;
    busiestMonth: { month: number; seconds: number } | null;
    favouriteHour: { hour: number; plays: number } | null;
    /** Watch seconds per month, index 0 = January. */
    monthlySeconds: number[];
    /** Plays started per local hour, index 0 = 00:00. */
    hourlyPlays: number[];
    devices: { name: string; plays: number; seconds: number }[];
    /** null when genre data is unavailable (see wrapped-genres.ts). */
    genres: WrappedGenre[] | null;
    rank: WrappedRank | null;
};

export type WrappedParams = { userId: string; year: number; allowedServerIds?: string[] };

export const yearBounds = (year: number) => ({
    since: new Date(year, 0, 1).getTime(),
    until: new Date(year + 1, 0, 1).getTime(),
});

type TopRow = { mediaId: number; title: string; year: number | null; plays: number; duration: number };

const toTitles = (rows: TopRow[], thumbs: Map<number, ThumbRef>): WrappedTitle[] =>
    rows.map((r) => ({
        mediaId: r.mediaId,
        title: r.title,
        year: r.year,
        plays: r.plays,
        seconds: r.duration ?? 0,
        thumb: thumbs.get(r.mediaId) ?? null,
    }));

const userName = (userId: string): string => {
    const row = db.prepare(`
        SELECT COALESCE(
          (SELECT title FROM user_identities WHERE accountId = ?),
          (SELECT user FROM activity_history WHERE userId = ? ORDER BY startTime DESC LIMIT 1)
        ) AS name
    `).get(userId, userId) as { name: string | null };
    return row.name ?? userId;
};

export const getWrapped = ({ userId, year, allowedServerIds }: WrappedParams): WrappedData => {
    const { since, until } = yearBounds(year);
    const filter = { since, until, allowedServerIds, userId };
    const { where, args } = buildFilter(filter);
    const qualifiedWhere = `${where} AND ${QUALIFIED}`;

    const totals = db.prepare(`
        SELECT
          COUNT(DISTINCT CASE WHEN ${QUALIFIED} THEN ${PLAY_KEY} END) AS plays,
          COALESCE(SUM(${SECONDS}), 0) AS seconds,
          COUNT(DISTINCT ${LOCAL("%Y-%m-%d")}) AS activeDays,
          COUNT(DISTINCT CASE WHEN ${QUALIFIED} THEN h.mediaId END) AS titles
        FROM activity_history h WHERE ${where}
    `).get(...args) as WrappedData["totals"];

    const topMovies = getTopMovies({ ...filter, limit: TOP_TITLES }) as TopRow[];
    const topShows = getTopShows({ ...filter, limit: TOP_TITLES }) as TopRow[];

    const bingeRows = db.prepare(`
        SELECT h.startTime, h.stopTime, h.mediaId, e.showMediaId, p.title AS showTitle, ${SECONDS} AS seconds
        FROM activity_history h
        JOIN media_items e ON h.mediaId = e.id AND e.showMediaId IS NOT NULL
        JOIN media_items p ON e.showMediaId = p.id
        WHERE ${qualifiedWhere}
        ORDER BY h.startTime
    `).all(...args) as BingeRow[];
    const binge = findLongestBinge(bingeRows);

    const busiestDay = db.prepare(`
        SELECT ${LOCAL("%Y-%m-%d")} AS date, SUM(${SECONDS}) AS seconds, COUNT(*) AS plays
        FROM activity_history h WHERE ${where}
        GROUP BY date ORDER BY seconds DESC, date LIMIT 1
    `).get(...args) as WrappedData["busiestDay"] | undefined;

    const monthRows = db.prepare(`
        SELECT CAST(${LOCAL("%m")} AS INTEGER) AS month, SUM(${SECONDS}) AS seconds
        FROM activity_history h WHERE ${where} GROUP BY month
    `).all(...args) as { month: number; seconds: number }[];
    const monthlySeconds = Array.from({ length: MONTHS_PER_YEAR }, () => 0);
    for (const r of monthRows) monthlySeconds[r.month - 1] = r.seconds;

    const hourRows = db.prepare(`
        SELECT CAST(${LOCAL("%H")} AS INTEGER) AS hour, COUNT(*) AS plays
        FROM activity_history h WHERE ${qualifiedWhere} GROUP BY hour
    `).all(...args) as { hour: number; plays: number }[];
    const hourlyPlays = Array.from({ length: HOURS_PER_DAY }, () => 0);
    for (const r of hourRows) hourlyPlays[r.hour] = r.plays;

    const devices = db.prepare(`
        SELECT COALESCE(NULLIF(TRIM(h.platform), ''), 'Unknown') AS name, COUNT(*) AS plays, SUM(${SECONDS}) AS seconds
        FROM activity_history h WHERE ${where}
        GROUP BY name ORDER BY seconds DESC LIMIT ?
    `).all(...args, TOP_DEVICES) as WrappedData["devices"];

    const thumbs = resolveMediaThumbs(
        [...topMovies, ...topShows].map((r) => r.mediaId).concat(binge ? [binge.showMediaId] : []),
        allowedServerIds,
    );

    const peakMonth = monthlySeconds.reduce((best, s, i) => (s > monthlySeconds[best] ? i : best), 0);
    const peakHour = hourlyPlays.reduce((best, p, i) => (p > hourlyPlays[best] ? i : best), 0);

    return {
        userId,
        userName: userName(userId),
        year,
        totals,
        topMovies: toTitles(topMovies, thumbs),
        topShows: toTitles(topShows, thumbs),
        longestBinge: binge ? { ...binge, thumb: thumbs.get(binge.showMediaId) ?? null } : null,
        busiestDay: busiestDay ?? null,
        busiestMonth: monthlySeconds[peakMonth] > 0 ? { month: peakMonth + 1, seconds: monthlySeconds[peakMonth] } : null,
        favouriteHour: hourlyPlays[peakHour] > 0 ? { hour: peakHour, plays: hourlyPlays[peakHour] } : null,
        monthlySeconds,
        hourlyPlays,
        devices,
        genres: getWrappedGenres(qualifiedWhere, args),
        rank: totals.seconds > 0 ? getWrappedRank(userId, since, until, allowedServerIds) : null,
    };
};
