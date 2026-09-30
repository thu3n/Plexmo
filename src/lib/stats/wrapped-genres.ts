import { db } from "../db";
import { Logger } from "../logger";

/**
 * Genre breakdown for Wrapped. Genres come from library_item_genres, filled
 * by the library sync since migration v18. Detected at runtime instead of
 * assumed: the table can be absent on a DB migrated by an older build that
 * shares the config volume, and it stays empty until the first sync after the
 * upgrade — both cases return null ("no genre data") rather than an error.
 */

const GENRE_TABLE = "library_item_genres";
const TOP_GENRES = 5;

export type WrappedGenre = { genre: string; plays: number };

const hasGenreTable = (): boolean =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(GENRE_TABLE);

/**
 * `where`/`args` are the Wrapped history filter (alias `h`, already
 * qualified-play gated). Episodes inherit their show's genres — Plex tags the
 * series, not each episode.
 */
export const getWrappedGenres = (where: string, args: (string | number)[]): WrappedGenre[] | null => {
    if (!hasGenreTable()) return null;
    try {
        const rows = db.prepare(`
            SELECT g.genre AS genre, COUNT(DISTINCT h.id) AS plays
            FROM activity_history h
            JOIN media_items m ON m.id = h.mediaId
            JOIN library_items li ON li.mediaId = COALESCE(m.showMediaId, m.id)
            JOIN ${GENRE_TABLE} g ON g.serverId = li.serverId AND g.ratingKey = li.ratingKey
            WHERE ${where}
            GROUP BY g.genre
            ORDER BY plays DESC, g.genre
            LIMIT ?
        `).all(...args, TOP_GENRES) as WrappedGenre[];
        return rows.length > 0 ? rows : null;
    } catch (e) {
        // A schema other than the one v18 creates — degrade to "no genres".
        Logger.error("[Wrapped] Genre query failed:", e);
        return null;
    }
};
