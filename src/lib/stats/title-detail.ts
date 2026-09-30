import { db } from "../db";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import {
    LOCAL_DAY,
    QUALIFIED_PLAY,
    playCountSql,
    titleMatchSql,
    windowSql,
    type TitleRef,
    type TitleWindow,
} from "./title-detail-query";

/**
 * Per-title drill-down for /statistics/title/[mediaId]: headline numbers,
 * who watched, plays over time, delivered quality, per-server split and (for
 * shows) the episode breakdown. Every query runs through the same window +
 * scope filter, so a scoped viewer never sees rows from foreign servers.
 */

export type TitleBucket = "day" | "month";

export type TitleSummary = {
    plays: number;
    sessions: number;
    uniqueUsers: number;
    totalSeconds: number;
    /** Mean of each viewer's furthest completion per item, 0-100; null when unknown. */
    avgCompletion: number | null;
    firstPlayed: number | null;
    lastPlayed: number | null;
};

export type TitleViewer = {
    accountId: string;
    user: string;
    thumb: string | null;
    plays: number;
    seconds: number;
    lastWatched: number;
    /** Furthest completion (movies/episodes) — null for shows or unknown. */
    completion: number | null;
    /** Distinct episodes with a qualified play (shows only). */
    episodes: number | null;
};

export type TitleSeriesRow = { bucket: string; plays: number; seconds: number; users: number };
export type TitleShareRow = { bucket: string; total: number };
export type TitleServerRow = { serverId: string; serverName: string | null; plays: number; sessions: number; seconds: number };
export type TitleEpisodeRow = {
    mediaId: number;
    title: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    plays: number;
    uniqueUsers: number;
    avgCompletion: number | null;
};

export type TitleDetail = {
    title: TitleRef & { thumb: ThumbRef | null };
    summary: TitleSummary;
    viewers: TitleViewer[];
    series: TitleSeriesRow[];
    decisions: TitleShareRow[];
    resolutions: TitleShareRow[];
    servers: TitleServerRow[];
    episodes: TitleEpisodeRow[] | null;
};

// Constant whitelist — interpolated into SQL, never user input.
const BUCKET_SQL: Record<TitleBucket, string> = {
    day: LOCAL_DAY,
    month: `strftime('%Y-%m', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`,
};

const MAX_VIEWERS = 200;
const MAX_EPISODES = 1000;
const SECONDS = "COALESCE(h.play_duration, h.duration)";

const filterFor = (ref: TitleRef, window: TitleWindow) => {
    const match = titleMatchSql(ref);
    const scope = windowSql(window);
    return { where: `${match.sql} AND ${scope.sql}`, args: [...match.args, ...scope.args] };
};

const roundOrNull = (value: number | null): number | null => (value === null ? null : Math.round(value));

const getSummary = (ref: TitleRef, window: TitleWindow): TitleSummary => {
    const { where, args } = filterFor(ref, window);
    const row = db.prepare(`
        SELECT ${playCountSql(ref.type)} as plays,
               COUNT(*) as sessions,
               COUNT(DISTINCT CASE WHEN ${QUALIFIED_PLAY} THEN h.userId END) as uniqueUsers,
               COALESCE(SUM(${SECONDS}), 0) as totalSeconds,
               MIN(h.startTime) as firstPlayed,
               MAX(h.stopTime) as lastPlayed
        FROM activity_history h
        WHERE ${where}
    `).get(...args) as Omit<TitleSummary, "avgCompletion">;
    const completion = db.prepare(`
        SELECT AVG(best) as avgCompletion FROM (
            SELECT MAX(h.percent_complete) as best
            FROM activity_history h
            WHERE ${where} AND h.percent_complete IS NOT NULL
            GROUP BY h.userId, h.mediaId
        )
    `).get(...args) as { avgCompletion: number | null };
    return { ...row, avgCompletion: roundOrNull(completion.avgCompletion) };
};

const getViewers = (ref: TitleRef, window: TitleWindow): TitleViewer[] => {
    const { where, args } = filterFor(ref, window);
    const isShow = ref.type === "show";
    return db.prepare(`
        SELECT h.userId as accountId,
               COALESCE(ui.title, MAX(h.user)) as user,
               ui.thumb as thumb,
               ${playCountSql(ref.type)} as plays,
               COALESCE(SUM(${SECONDS}), 0) as seconds,
               MAX(h.stopTime) as lastWatched,
               ${isShow ? "NULL" : "MAX(h.percent_complete)"} as completion,
               ${isShow ? `COUNT(DISTINCT CASE WHEN ${QUALIFIED_PLAY} THEN h.mediaId END)` : "NULL"} as episodes
        FROM activity_history h
        LEFT JOIN user_identities ui ON h.userId = ui.accountId
        WHERE ${where} AND h.userId IS NOT NULL
        GROUP BY h.userId
        ORDER BY plays DESC, lastWatched DESC
        LIMIT ?
    `).all(...args, MAX_VIEWERS) as TitleViewer[];
};

const getSeries = (ref: TitleRef, window: TitleWindow, bucket: TitleBucket): TitleSeriesRow[] => {
    const { where, args } = filterFor(ref, window);
    return db.prepare(`
        SELECT ${BUCKET_SQL[bucket]} as bucket,
               ${playCountSql(ref.type)} as plays,
               COALESCE(SUM(${SECONDS}), 0) as seconds,
               COUNT(DISTINCT h.userId) as users
        FROM activity_history h
        WHERE ${where}
        GROUP BY bucket
        ORDER BY bucket
    `).all(...args) as TitleSeriesRow[];
};

const getShare = (ref: TitleRef, window: TitleWindow, column: "transcode_decision" | "stream_video_resolution") => {
    const { where, args } = filterFor(ref, window);
    return db.prepare(`
        SELECT COALESCE(h.${column}, 'unknown') as bucket, COUNT(*) as total
        FROM activity_history h
        WHERE ${where}
        GROUP BY bucket
        ORDER BY total DESC
    `).all(...args) as TitleShareRow[];
};

const getServers = (ref: TitleRef, window: TitleWindow): TitleServerRow[] => {
    const { where, args } = filterFor(ref, window);
    return db.prepare(`
        SELECT h.serverId, s.name as serverName,
               ${playCountSql(ref.type)} as plays,
               COUNT(*) as sessions,
               COALESCE(SUM(${SECONDS}), 0) as seconds
        FROM activity_history h
        LEFT JOIN servers s ON h.serverId = s.id
        WHERE ${where}
        GROUP BY h.serverId
        ORDER BY plays DESC, sessions DESC
    `).all(...args) as TitleServerRow[];
};

const getEpisodes = (ref: TitleRef, window: TitleWindow): TitleEpisodeRow[] => {
    const { where, args } = filterFor(ref, window);
    const rows = db.prepare(`
        SELECT e.id as mediaId, e.title, e.seasonNumber, e.episodeNumber,
               ${playCountSql("episode")} as plays,
               COUNT(DISTINCT CASE WHEN ${QUALIFIED_PLAY} THEN h.userId END) as uniqueUsers,
               AVG(h.percent_complete) as avgCompletion
        FROM activity_history h
        JOIN media_items e ON h.mediaId = e.id
        WHERE ${where}
        GROUP BY e.id
        ORDER BY e.seasonNumber IS NULL, e.seasonNumber, e.episodeNumber
        LIMIT ?
    `).all(...args, MAX_EPISODES) as TitleEpisodeRow[];
    return rows.map((row) => ({ ...row, avgCompletion: roundOrNull(row.avgCompletion) }));
};

export const getTitleDetail = (ref: TitleRef, window: TitleWindow, bucket: TitleBucket): TitleDetail => {
    // Episodes carry no art of their own in the inventory — use the show poster.
    const posterId = ref.type === "episode" && ref.showMediaId ? ref.showMediaId : ref.mediaId;
    const thumb = resolveMediaThumbs([posterId], window.allowedServerIds).get(posterId) ?? null;
    return {
        title: { ...ref, thumb },
        summary: getSummary(ref, window),
        viewers: getViewers(ref, window),
        series: getSeries(ref, window, bucket),
        decisions: getShare(ref, window, "transcode_decision"),
        resolutions: getShare(ref, window, "stream_video_resolution"),
        servers: getServers(ref, window),
        episodes: ref.type === "show" ? getEpisodes(ref, window) : null,
    };
};
