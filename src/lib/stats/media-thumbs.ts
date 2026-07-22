import { db } from "../db";

export type ThumbRef = { path: string; serverId: string };

/**
 * Batch poster lookup for canonical media ids via the library inventory —
 * library_items.thumb is refreshed against live Plex every 6h, so the
 * (path, serverId) pair stays valid for the /api/image proxy (which resolves
 * credentials by serverId). History meta_json thumbs are frozen at watch time
 * and go stale when Plex regenerates art ids; they are deliberately not used.
 * First row per mediaId wins (ordered by serverId for determinism).
 */
export const resolveMediaThumbs = (
    mediaIds: number[],
    allowedServerIds?: string[]
): Map<number, ThumbRef> => {
    const ids = [...new Set(mediaIds)].filter((id) => Number.isFinite(id));
    if (ids.length === 0) return new Map();

    const conditions = [
        `mediaId IN (${ids.map(() => "?").join(",")})`,
        "thumb IS NOT NULL",
    ];
    const args: (number | string)[] = [...ids];
    if (allowedServerIds && allowedServerIds.length > 0) {
        conditions.push(`serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
        args.push(...allowedServerIds);
    }

    const rows = db.prepare(`
        SELECT mediaId, serverId, thumb
        FROM library_items
        WHERE ${conditions.join(" AND ")}
        ORDER BY serverId
    `).all(...args) as { mediaId: number; serverId: string; thumb: string }[];

    const thumbs = new Map<number, ThumbRef>();
    for (const row of rows) {
        if (!thumbs.has(row.mediaId)) {
            thumbs.set(row.mediaId, { path: row.thumb, serverId: row.serverId });
        }
    }

    // Fallback for media missing from the library inventory (content on a server
    // whose library no longer lists it, or shows never inventoried): synthesize
    // the PMS canonical poster path from the media_sources mapping — Plex serves
    // the CURRENT primary art at /library/metadata/<ratingKey>/thumb, so no
    // stored (and stale-prone) thumb id is needed. Worst case it 404s through
    // the proxy, which renders the same empty box as no thumb at all.
    const missing = ids.filter((id) => !thumbs.has(id));
    if (missing.length > 0) {
        const sourceConditions = [`mediaId IN (${missing.map(() => "?").join(",")})`];
        const sourceArgs: (number | string)[] = [...missing];
        if (allowedServerIds && allowedServerIds.length > 0) {
            sourceConditions.push(`serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
            sourceArgs.push(...allowedServerIds);
        }
        const sources = db.prepare(`
            SELECT mediaId, serverId, ratingKey
            FROM media_sources
            WHERE ${sourceConditions.join(" AND ")}
            ORDER BY serverId
        `).all(...sourceArgs) as { mediaId: number; serverId: string; ratingKey: string }[];
        for (const source of sources) {
            if (!thumbs.has(source.mediaId)) {
                thumbs.set(source.mediaId, {
                    path: `/library/metadata/${source.ratingKey}/thumb`,
                    serverId: source.serverId,
                });
            }
        }
    }
    return thumbs;
};
