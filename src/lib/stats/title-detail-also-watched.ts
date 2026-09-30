import { db } from "../db";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import { LOCAL_DAY, QUALIFIED_PLAY, titleMatchSql, windowSql, type TitleRef, type TitleWindow } from "./title-detail-query";

/**
 * "Also watched": co-occurrence recommendations. The audience of a title is
 * everyone with a qualified play of it in the window; every OTHER title those
 * people played (episodes rolled up to their show) is ranked by how many of
 * them it shares, then by plays. Same window + scope as the title page, so a
 * scoped viewer's recommendations never leak foreign-server activity.
 */

export const DEFAULT_ALSO_WATCHED_LIMIT = 12;

export type AlsoWatchedItem = {
    mediaId: number;
    type: "movie" | "show";
    title: string;
    year: number | null;
    /** Viewers of the source title who also played this one. */
    sharedUsers: number;
    plays: number;
    thumb: ThumbRef | null;
};

type Row = Omit<AlsoWatchedItem, "thumb">;

export const getAlsoWatched = (
    ref: TitleRef,
    window: TitleWindow,
    limit: number = DEFAULT_ALSO_WATCHED_LIMIT,
): AlsoWatchedItem[] => {
    const match = titleMatchSql(ref);
    const scope = windowSql(window);
    // An episode's "title" is its show — recommending the show it belongs to is noise.
    const excludeId = ref.type === "episode" && ref.showMediaId ? ref.showMediaId : ref.mediaId;

    const rows = db.prepare(`
        WITH audience AS (
            SELECT DISTINCT h.userId
            FROM activity_history h
            WHERE ${match.sql} AND ${scope.sql} AND ${QUALIFIED_PLAY} AND h.userId IS NOT NULL
        ),
        overlap AS (
            SELECT COALESCE(m.showMediaId, m.id) as titleId,
                   COUNT(DISTINCT h.userId) as sharedUsers,
                   COUNT(DISTINCT h.userId || ':' || h.mediaId || ':' || ${LOCAL_DAY}) as plays
            FROM activity_history h
            JOIN media_items m ON h.mediaId = m.id AND m.type IN ('movie', 'episode')
            WHERE ${scope.sql} AND ${QUALIFIED_PLAY}
              AND h.userId IN (SELECT userId FROM audience)
            GROUP BY titleId
        )
        SELECT t.id as mediaId, t.type, t.title, t.year, o.sharedUsers, o.plays
        FROM overlap o
        JOIN media_items t ON t.id = o.titleId AND t.type IN ('movie', 'show')
        WHERE o.titleId != ? AND o.titleId != ?
        ORDER BY o.sharedUsers DESC, o.plays DESC, t.title
        LIMIT ?
    `).all(...match.args, ...scope.args, ...scope.args, excludeId, ref.mediaId, limit) as Row[];

    const thumbs = resolveMediaThumbs(rows.map((r) => r.mediaId), window.allowedServerIds);
    return rows.map((row) => ({ ...row, thumb: thumbs.get(row.mediaId) ?? null }));
};
