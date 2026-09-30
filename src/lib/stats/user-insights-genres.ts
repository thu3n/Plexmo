import { db } from "../db";
import {
    QUALIFIED_PLAY_SQL,
    buildWindowFilter,
    scopeColumnFilter,
    type PeopleScope,
} from "./user-insights-shared";

/**
 * Genre stats. A play reaches its genres through the canonical title:
 * activity_history.mediaId -> media_items (episodes roll up to their show) ->
 * library_items.mediaId -> library_item_genres (migration v18, filled by the
 * library sync). The same title on several servers yields duplicate genre
 * rows, so plays are DISTINCTed per (history row, genre) before aggregating.
 */

const DEFAULT_GENRE_LIMIT = 10;

export type GenreStat = {
    genre: string;
    plays: number;
    users: number;
    /** Watched seconds attributed to the genre (a multi-genre title counts toward each). */
    seconds: number;
};

export type GenreParams = PeopleScope & { userId?: string; limit?: number };

export const getTopGenres = (params: GenreParams): GenreStat[] => {
    const { where, args } = buildWindowFilter(params);
    // Library rows from servers outside the viewer's scope never contribute tags.
    const libraryScope = scopeColumnFilter("li.serverId", params.allowedServerIds);
    return db.prepare(`
        WITH plays AS (
            SELECT h.id, h.userId,
                   COALESCE(h.play_duration, h.duration, 0) AS seconds,
                   COALESCE(m.showMediaId, m.id) AS titleId
            FROM activity_history h
            JOIN media_items m ON m.id = h.mediaId
            WHERE ${where} AND ${QUALIFIED_PLAY_SQL}
        ),
        tagged AS (
            SELECT DISTINCT p.id, p.userId, p.seconds, g.genre
            FROM plays p
            JOIN library_items li ON li.mediaId = p.titleId${libraryScope.sql}
            JOIN library_item_genres g ON g.serverId = li.serverId AND g.ratingKey = li.ratingKey
        )
        SELECT genre, COUNT(*) AS plays, COUNT(DISTINCT userId) AS users, SUM(seconds) AS seconds
        FROM tagged
        GROUP BY genre
        ORDER BY plays DESC, seconds DESC, genre ASC
        LIMIT ?
    `).all(...args, ...libraryScope.args, params.limit ?? DEFAULT_GENRE_LIMIT) as GenreStat[];
};

/** False until the first library sync after migration v18 — lets the UI explain an empty list. */
export const hasGenreData = (): boolean =>
    db.prepare("SELECT 1 FROM library_item_genres LIMIT 1").get() !== undefined;
