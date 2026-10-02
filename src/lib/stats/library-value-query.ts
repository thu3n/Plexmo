import { db } from "../db";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";
import type { ThumbRef } from "./media-thumbs";

/**
 * One row per library copy (server × ratingKey) with its lifetime play facts —
 * the single input every library-value metric is derived from in JS.
 *
 * Matching rules:
 * - Plays are matched on the SAME server: a copy on server A that is only ever
 *   watched on server B is still dead weight on A's disk.
 * - Shows are matched through their episodes (media_items.showMediaId).
 * - Plays use the same qualified-play gate and (user, day, item) dedupe as
 *   the top-media stats, so a 30-second preview never "rescues" a title.
 * - Copies without a canonical mediaId cannot be matched to history at all;
 *   they are excluded rather than reported as never played (false positives).
 */

export type LibraryMediaType = "movie" | "show";

export const LIBRARY_MEDIA_TYPES: readonly LibraryMediaType[] = ["movie", "show"];

export type LibraryItemFacts = {
    serverId: string;
    serverName: string | null;
    ratingKey: string;
    sectionKey: string;
    sectionTitle: string | null;
    mediaId: number;
    type: LibraryMediaType;
    title: string;
    year: number | null;
    /** Epoch ms, null when Plex did not report it. */
    addedAt: number | null;
    /** Bytes of the first media part. Always null for shows (the inventory has no episode sizes). */
    fileSize: number | null;
    thumb: ThumbRef | null;
    /** Lifetime qualified plays on this server. */
    plays: number;
    lastPlayed: number | null;
    /** First qualified play at or after addedAt (plays before a re-add are ignored). */
    firstPlayAfterAdded: number | null;
};

export type LibraryScopeParams = {
    /** Explicit server filter (already scope-checked by the route). */
    serverId?: string;
    /** Authorization scope: when set, only these servers' rows are read. */
    allowedServerIds?: string[];
};

type FactsRow = Omit<LibraryItemFacts, "thumb"> & { thumbPath: string | null };

const QUALIFIED_PLAY = `(
  h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK})
)`;

const serverConditions = (column: string, { serverId, allowedServerIds }: LibraryScopeParams) => {
    const conditions: string[] = [];
    const args: string[] = [];
    if (allowedServerIds && allowedServerIds.length > 0) {
        conditions.push(`${column} IN (${allowedServerIds.map(() => "?").join(",")})`);
        args.push(...allowedServerIds);
    }
    if (serverId && serverId !== "all") {
        conditions.push(`${column} = ?`);
        args.push(serverId);
    }
    return { sql: conditions.map((c) => ` AND ${c}`).join(""), args };
};

export const getLibraryItemFacts = (params: LibraryScopeParams): LibraryItemFacts[] => {
    const historyScope = serverConditions("h.serverId", params);
    const itemScope = serverConditions("li.serverId", params);

    // MATERIALIZED: the play set is joined once per library copy; SQLite builds
    // an automatic index on the materialized CTE instead of re-scanning history.
    // The CAST matters: a bare COALESCE has no column affinity, so the
    // automatic index left libMediaId out and every library copy scanned all of
    // its server's plays (~2 min on a 135k-row history).
    const rows = db.prepare(`
        WITH plays AS MATERIALIZED (
            SELECT
                h.serverId,
                CAST(COALESCE(e.showMediaId, h.mediaId) AS INTEGER) AS libMediaId,
                COALESCE(h.userId, h.user) || ':' || h.mediaId || ':' ||
                    strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) AS playKey,
                h.startTime
            FROM activity_history h
            LEFT JOIN media_items e ON e.id = h.mediaId
            WHERE h.mediaId IS NOT NULL AND ${QUALIFIED_PLAY}${historyScope.sql}
        )
        SELECT
            li.serverId,
            s.name AS serverName,
            li.ratingKey,
            li.sectionKey,
            ls.title AS sectionTitle,
            li.mediaId,
            li.type,
            COALESCE(li.title, 'Unknown') AS title,
            li.year,
            li.addedAt,
            li.fileSize,
            li.thumb AS thumbPath,
            COUNT(DISTINCT p.playKey) AS plays,
            MAX(p.startTime) AS lastPlayed,
            MIN(CASE WHEN li.addedAt IS NULL OR p.startTime >= li.addedAt THEN p.startTime END) AS firstPlayAfterAdded
        FROM library_items li
        LEFT JOIN library_sections ls ON ls.serverId = li.serverId AND ls.sectionKey = li.sectionKey
        LEFT JOIN servers s ON s.id = li.serverId
        LEFT JOIN plays p ON p.serverId = li.serverId AND p.libMediaId = li.mediaId
        WHERE li.type IN ('movie', 'show') AND li.mediaId IS NOT NULL${itemScope.sql}
        GROUP BY li.serverId, li.ratingKey
    `).all(...historyScope.args, ...itemScope.args) as FactsRow[];

    return rows.map(({ thumbPath, ...row }) => ({
        ...row,
        thumb: thumbPath ? { path: thumbPath, serverId: row.serverId } : null,
    }));
};
