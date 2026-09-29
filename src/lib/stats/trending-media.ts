import { getTopMovies, getTopShows, type HomeStatsParams } from "./home-stats";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";

/**
 * "Trending" = titles whose qualified plays grew the most versus the equally
 * long window right before the current one. Both windows reuse the top-media
 * aggregations (same qualified-play gate and (user, day) dedupe), fetched in
 * full and diffed in JS — bounded by distinct media played, not history size.
 */

const ALL_ROWS_LIMIT = 1_000_000;
const DEFAULT_TRENDING_LIMIT = 10;
/** A single play jumping from 0 → 1 is noise, not a trend. */
export const MIN_TRENDING_PLAYS = 2;

export type TrendingMediaType = "movie" | "show";

export type TrendingMediaItem = {
    mediaId: number;
    title: string;
    year: number | null;
    /** Plays in the current window [since, until). */
    plays: number;
    /** Plays in the previous window [since - length, since). */
    previousPlays: number;
    delta: number;
    /** Unique users in the current window. */
    uniqueUsers: number;
    thumb: ThumbRef | null;
};

export type TrendingMediaParams = Pick<HomeStatsParams, "since" | "until" | "serverId" | "allowedServerIds"> & {
    limit?: number;
};

type AggregatedRow = {
    mediaId: number;
    title: string;
    year: number | null;
    plays: number;
    uniqueUsers: number;
};

const QUERY_BY_TYPE: Record<TrendingMediaType, (params: HomeStatsParams) => unknown[]> = {
    movie: getTopMovies,
    show: getTopShows,
};

export const getTrendingMedia = (
    type: TrendingMediaType,
    params: TrendingMediaParams,
): TrendingMediaItem[] => {
    const { since, serverId, allowedServerIds } = params;
    const until = params.until ?? Date.now();
    const windowLength = until - since;
    const limit = params.limit ?? DEFAULT_TRENDING_LIMIT;
    const query = QUERY_BY_TYPE[type];

    const current = query({ since, until, serverId, allowedServerIds, limit: ALL_ROWS_LIMIT }) as AggregatedRow[];
    const previous = query({
        since: since - windowLength,
        until: since,
        serverId,
        allowedServerIds,
        limit: ALL_ROWS_LIMIT,
    }) as AggregatedRow[];

    const previousPlays = new Map(previous.map((row) => [row.mediaId, row.plays]));

    const ranked = current
        .map((row) => {
            const prior = previousPlays.get(row.mediaId) ?? 0;
            return {
                mediaId: row.mediaId,
                title: row.title,
                year: row.year,
                plays: row.plays,
                previousPlays: prior,
                delta: row.plays - prior,
                uniqueUsers: row.uniqueUsers,
            };
        })
        .filter((item) => item.delta > 0 && item.plays >= MIN_TRENDING_PLAYS)
        .sort((a, b) => b.delta - a.delta || b.plays - a.plays)
        .slice(0, limit);

    const thumbs = resolveMediaThumbs(ranked.map((item) => item.mediaId), allowedServerIds);
    return ranked.map((item) => ({ ...item, thumb: thumbs.get(item.mediaId) ?? null }));
};
