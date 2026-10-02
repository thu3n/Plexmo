import { db } from "../db";
import { WATCHED_THRESHOLD_PERCENT } from "../history/session-facts";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import {
    DEFAULT_BEHAVIOUR_LIMIT,
    ONE_DAY_MS,
    QUALIFIED_PLAY_SQL,
    behaviourFilter,
    type BehaviourParams,
} from "./viewing-behaviour";
import { ABANDON_AFTER_DAYS } from "./viewing-behaviour-constants";

/**
 * Abandoned series: a user got into a show, stopped mid-season, and hasn't
 * touched it for ABANDON_AFTER_DAYS. "Mid-season" = their last episode was
 * left unfinished, or a later episode of that same season is known to exist
 * (someone on the instance has played it). Finishing a season's last known
 * episode reads as "between seasons", not abandoned.
 *
 * The window selects WHEN the abandonment became visible: last activity + the
 * grace period falls inside [since, until). A 30-day view therefore lists
 * shows dropped 30–60 days ago, not an always-empty "dropped in the last 30
 * days and also 30 days quiet".
 */

export { ABANDON_AFTER_DAYS };
/** One episode is sampling a pilot; two means the user was actually watching. */
export const MIN_ABANDON_EPISODES = 2;

export type AbandonedSeries = {
    userId: string;
    user: string;
    showId: number;
    showTitle: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    /** Position in the last episode, when known. */
    lastPercent: number | null;
    episodesWatched: number;
    lastWatchedAt: number;
};

export type AbandonedShow = { mediaId: number; title: string; users: number; thumb: ThumbRef | null };

export type AbandonedStats = {
    total: number;
    /** Most recently abandoned first. */
    items: AbandonedSeries[];
    /** Shows most users walked away from. */
    shows: AbandonedShow[];
};

const rankShows = (items: AbandonedSeries[], limit: number): Omit<AbandonedShow, "thumb">[] => {
    const byShow = new Map<number, Omit<AbandonedShow, "thumb">>();
    for (const item of items) {
        const entry = byShow.get(item.showId) ?? { mediaId: item.showId, title: item.showTitle, users: 0 };
        entry.users += 1;
        byShow.set(item.showId, entry);
    }
    return [...byShow.values()]
        .sort((a, b) => b.users - a.users || a.title.localeCompare(b.title))
        .slice(0, limit);
};

export const getAbandonedSeries = (params: BehaviourParams): AbandonedStats => {
    const graceMs = ABANDON_AFTER_DAYS * ONE_DAY_MS;
    // Full history up to `until`: "episodes watched" and "last activity" must
    // see plays from before the window, only the abandonment moment is windowed.
    const { where, args } = behaviourFilter({ ...params, since: 0 });
    const limit = params.limit ?? DEFAULT_BEHAVIOUR_LIMIT;

    const items = db.prepare(`
        WITH plays AS (
            SELECT
                h.userId AS userId,
                h.user AS userName,
                e.showMediaId AS showId,
                e.id AS episodeId,
                e.seasonNumber AS seasonNumber,
                e.episodeNumber AS episodeNumber,
                h.percent_complete AS pct,
                h.startTime AS startTime,
                h.stopTime AS stopTime
            FROM activity_history h
            JOIN media_items e ON h.mediaId = e.id AND e.showMediaId IS NOT NULL
            WHERE ${where} AND h.userId IS NOT NULL AND ${QUALIFIED_PLAY_SQL}
        ),
        summary AS (
            SELECT userId, showId, COUNT(DISTINCT episodeId) AS episodes, MAX(stopTime) AS lastAt
            FROM plays
            GROUP BY userId, showId
        ),
        last AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY userId, showId ORDER BY startTime DESC) AS rn
            FROM plays
        ),
        -- Aggregated once: a correlated "later episode exists?" lookup scanned
        -- media_items per row (the only showMediaId index is partial).
        season_max AS (
            SELECT showMediaId, seasonNumber, MAX(episodeNumber) AS maxEpisode
            FROM media_items
            WHERE showMediaId IS NOT NULL
            GROUP BY showMediaId, seasonNumber
        )
        SELECT
            l.userId AS userId,
            COALESCE(ui.title, l.userName) AS user,
            l.showId AS showId,
            t.title AS showTitle,
            l.seasonNumber AS seasonNumber,
            l.episodeNumber AS episodeNumber,
            l.pct AS lastPercent,
            s.episodes AS episodesWatched,
            s.lastAt AS lastWatchedAt
        FROM last l
        JOIN summary s ON s.userId = l.userId AND s.showId = l.showId
        JOIN media_items t ON t.id = l.showId
        LEFT JOIN user_identities ui ON ui.accountId = l.userId
        LEFT JOIN season_max sm ON sm.showMediaId = l.showId AND sm.seasonNumber = l.seasonNumber
        WHERE l.rn = 1
          AND s.episodes >= ?
          AND s.lastAt >= ? AND s.lastAt < ?
          AND (
            (l.pct IS NOT NULL AND l.pct < ?)
            OR sm.maxEpisode > l.episodeNumber
          )
        ORDER BY s.lastAt DESC
    `).all(
        ...args,
        MIN_ABANDON_EPISODES,
        params.since - graceMs,
        params.until - graceMs,
        WATCHED_THRESHOLD_PERCENT,
    ) as AbandonedSeries[];

    const shows = rankShows(items, limit);
    const thumbs = resolveMediaThumbs(shows.map((s) => s.mediaId), params.allowedServerIds);

    return {
        total: items.length,
        items: items.slice(0, limit),
        shows: shows.map((s) => ({ ...s, thumb: thumbs.get(s.mediaId) ?? null })),
    };
};
