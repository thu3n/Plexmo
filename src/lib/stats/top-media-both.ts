import {
    getTopEpisodes,
    getTopMovies,
    getTopShows,
    type HomeStatsParams,
} from "./home-stats";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";

/**
 * One aggregation, both rankings. The by-plays and by-users top lists share the
 * exact same GROUP BY — only the ORDER BY differs — so running the query twice
 * (as the UI's two toggle variants used to) doubles the most expensive stats
 * work for nothing. This fetches ALL aggregated rows once (bounded by distinct
 * media played in the window, not history size) and sorts twice in JS.
 */

const ALL_ROWS_LIMIT = 1_000_000;
const DEFAULT_TOP_LIMIT = 10;

export type TopMediaType = "movie" | "show" | "episode";

export type TopMediaRow = {
    mediaId: number;
    title: string;
    year: number | null;
    plays: number;
    uniqueUsers: number;
    duration: number;
    lastPlayed: number;
    showMediaId?: number | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    showTitle?: string | null;
};

export type TopMediaItemWithThumb = TopMediaRow & { thumb: ThumbRef | null };

export type TopMediaBothResult = {
    byUsers: TopMediaItemWithThumb[];
    byPlays: TopMediaItemWithThumb[];
};

const QUERY_BY_TYPE: Record<TopMediaType, (params: HomeStatsParams) => unknown[]> = {
    movie: getTopMovies,
    show: getTopShows,
    episode: getTopEpisodes,
};

// Episodes prefer the show's poster; an orphaned episode (no linked show —
// metadata-poor items like "Episode #3.1") falls back to its own art so the
// row isn't a blank box.
const thumbIdFor = (row: TopMediaRow, type: TopMediaType): number | null =>
    type === "episode" ? (row.showMediaId ?? row.mediaId) : row.mediaId;

export const getTopMediaBoth = (
    type: TopMediaType,
    params: Omit<HomeStatsParams, "limit" | "orderBy"> & { limit?: number },
): TopMediaBothResult => {
    const limit = params.limit ?? DEFAULT_TOP_LIMIT;
    // orderBy "plays" makes the raw rows arrive in the legacy plays-DESC order.
    const rows = QUERY_BY_TYPE[type]({
        ...params,
        limit: ALL_ROWS_LIMIT,
        orderBy: "plays",
    }) as TopMediaRow[];

    const byPlaysRows = rows.slice(0, limit);
    // Mirrors ORDER_SQL.uniqueUsers ("uniqueUsers DESC, plays DESC") exactly.
    const byUsersRows = [...rows]
        .sort((a, b) => b.uniqueUsers - a.uniqueUsers || b.plays - a.plays)
        .slice(0, limit);

    // Episodes render their show's poster — the library inventory carries no
    // per-episode art, so the thumb lookup goes through showMediaId.
    const thumbIds = [...byPlaysRows, ...byUsersRows]
        .map((row) => thumbIdFor(row, type))
        .filter((id): id is number => typeof id === "number");
    const thumbs = resolveMediaThumbs(thumbIds, params.allowedServerIds);

    const withThumb = (row: TopMediaRow): TopMediaItemWithThumb => ({
        ...row,
        thumb: thumbs.get(thumbIdFor(row, type) ?? -1) ?? null,
    });

    return { byUsers: byUsersRows.map(withThumb), byPlays: byPlaysRows.map(withThumb) };
};
