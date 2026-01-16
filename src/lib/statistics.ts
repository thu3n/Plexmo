import { db } from "@/lib/db";

export type StatisticItem = {
    title: string;
    ratingKey: string;
    serverId: string;
    uniqueUsers: number; // or totalPlays depending on context, using 'count' for sorting usually
    totalPlays: number;
    count: number;
    thumb?: string;
    type: string;
    year?: number;
};

export async function getPopularStats(
    range: string,
    type?: string | null,
    sort: string = "unique_users"
): Promise<StatisticItem[]> {

    // --- STRATEGY: LIVE AGGREGATION (From activity_history) ---
    // Calculate cutoff
    let cutoff = 0;
    const now = Date.now();
    switch (range) {
        case "24h": cutoff = now - (24 * 60 * 60 * 1000); break;
        case "7d": cutoff = now - (7 * 24 * 60 * 60 * 1000); break;
        case "30d": cutoff = now - (30 * 24 * 60 * 60 * 1000); break;
        case "90d": cutoff = now - (90 * 24 * 60 * 60 * 1000); break;
        case "all": cutoff = 0; break;
        default: cutoff = now - (24 * 60 * 60 * 1000);
    }

    // 1. Fetch History Slice with SQL JOINS
    // We join for both Show hierarchy (for episodes) and Direct Item (for movies/others)
    const query = `
        SELECT 
            h.title, h.ratingKey, h.serverId, h.meta_json,
            h.subtitle, h.user, h.duration, h.startTime,
            
            -- Show/Grandparent Info
            u_show.id as showUnifiedId,
            u_show.title as showUnifiedTitle,
            u_show.poster as showUnifiedPoster,
            u_show.year as showUnifiedYear,
            show.title as showTitleDb, 
            
            -- Direct Item Info
            u_direct.id as directUnifiedId,
            u_direct.title as directUnifiedTitle,
            u_direct.poster as directUnifiedPoster,
            u_direct.year as directUnifiedYear,
            u_direct.type as directUnifiedType,
            item.type as itemTypeDb,
            
            COALESCE(
                json_extract(h.meta_json, '$.thumb'),
                json_extract(u_direct.meta_json, '$.parentThumb'), 
                json_extract(u_direct.meta_json, '$.grandparentThumb'), 
                u_direct.poster,
                item.thumb
            ) as itemThumb

        FROM activity_history h
        
        -- 1. Join Legacy Item (so we can use it for fallback linking)
        LEFT JOIN library_items item ON (h.ratingKey = item.ratingKey AND h.serverId = item.serverId)

        -- 2. Join UnifiedItem (Direct) - Now we can access 'item' safely
        LEFT JOIN UnifiedItem u_direct ON (
            (h.plex_guid IS NOT NULL AND h.plex_guid = u_direct.guid) OR
            (h.imdb_id IS NOT NULL AND h.imdb_id = u_direct.imdb_id) OR
            (h.tmdb_id IS NOT NULL AND h.tmdb_id = u_direct.tmdb_id) OR
            (u_direct.id IS NULL AND h.title = u_direct.title) OR
            (item.unifiedItemId = u_direct.id)
        )

        -- 3. Join Grandparent/Show (Legacy)
        LEFT JOIN library_items show ON (
            json_extract(item.meta_json, '$.grandparentRatingKey') = show.ratingKey 
            AND item.serverId = show.serverId
        )

        -- 4. Join UnifiedItem (Show)
        LEFT JOIN UnifiedItem u_show ON (
            show.unifiedItemId = u_show.id
        )

        WHERE h.startTime > ? 
        ORDER BY h.startTime DESC
        LIMIT 50000
    `;
    const historyRows = db.prepare(query).all(cutoff) as any[];

    // 2. Aggregation
    const statsMap = new Map<string, {
        id: string, title: string, thumb?: string, type: string,
        users: Set<string>, totalPlays: number, totalDuration: number, year?: number
    }>();

    for (const row of historyRows) {
        // Parse Meta
        let meta: any = {};
        try {
            meta = JSON.parse(row.meta_json || '{}');
        } catch (e) { }

        // Determine raw item type from DB or Meta
        let itemType = row.itemTypeDb || row.directUnifiedType;
        if (!itemType) {
            if (meta.type) itemType = meta.type;
            else if (row.subtitle && row.subtitle.match(/S\d+E\d+/)) itemType = 'episode';
            else if (meta.grandparentTitle) itemType = 'episode';
        }

        // Filter by requested type
        if (type === 'show') {
            if (itemType !== 'episode' && itemType !== 'show') continue;
        } else if (type === 'movie') {
            if (itemType !== 'movie') continue;
        } else if (type === 'episode') {
            if (itemType !== 'episode') continue;
        }

        // Determine Aggregation Target
        let aggregateId = `orphan:${row.serverId}:${row.ratingKey}`;
        let aggregateTitle = row.title;
        let aggregateThumb: string | undefined = row.itemThumb ? `/api/proxy/image?serverId=${row.serverId}&thumb=${encodeURIComponent(row.itemThumb)}` : undefined;
        let aggregateType = itemType || 'unknown';
        let aggregateYear = row.directUnifiedYear;

        if (type === 'show') {
            // AGGREGATE TO SHOW
            // Priority 1: Unified Show ID
            if (row.showUnifiedId) {
                aggregateId = row.showUnifiedId;
                aggregateTitle = row.showUnifiedTitle || aggregateTitle;
                aggregateThumb = row.showUnifiedPoster || aggregateThumb;
                aggregateYear = row.showUnifiedYear;
                aggregateType = 'show';
            } else {
                // Priority 2: Unified ID of the item itself if it happens to be a show (unlikely in history but possible)
                if (itemType === 'show' && row.directUnifiedId) {
                    aggregateId = row.directUnifiedId;
                    aggregateTitle = row.directUnifiedTitle || aggregateTitle;
                    aggregateThumb = row.directUnifiedPoster || aggregateThumb;
                    aggregateYear = row.directUnifiedYear;
                    aggregateType = 'show';
                } else {
                    // Priority 3: Use show title from DB or Meta (Fallback / Orphan Show)
                    const fallbackShowTitle = row.showTitleDb || meta.grandparentTitle || meta.showTitle;
                    if (fallbackShowTitle) {
                        // We stick to an orphan-like ID, but DO NOT iterate strictly by title string to avoid the previous bug.
                        // But we still need to group them somehow. 
                        // The user asked to "Remove the logic that generates IDs looking like show_title:${showTitle}".
                        // However, for orphans, we MUST group them by title if we want "Most Watched Shows" to work for non-unified content.
                        // User instruction: "Fallback Logic: Keep the COALESCE logic strictly for items that truly have no match (orphans), but prioritize the UnifiedItem UUID above all else."
                        // This implies we CAN use title grouping for orphans, just not for unified items.
                        aggregateId = `show_title_orphan:${encodeURIComponent(fallbackShowTitle)}`;
                        aggregateTitle = fallbackShowTitle;
                        aggregateType = 'show';
                        if (meta.grandparentThumb) {
                            aggregateThumb = `/api/proxy/image?serverId=${row.serverId}&thumb=${encodeURIComponent(meta.grandparentThumb)}`;
                        }
                    } else {
                        // Can't determine show? Skip.
                        continue;
                    }
                }
            }
        }
        else if (type === 'movie') {
            // AGGREGATE TO MOVIE
            if (row.directUnifiedId) {
                aggregateId = row.directUnifiedId;
                aggregateTitle = row.directUnifiedTitle || aggregateTitle;
                aggregateThumb = row.directUnifiedPoster || aggregateThumb;
                aggregateYear = row.directUnifiedYear;
            }
        }
        else {
            // Mixed or Episode aggregation
            if (row.directUnifiedId) {
                aggregateId = row.directUnifiedId;
                aggregateTitle = row.directUnifiedTitle || aggregateTitle;
                aggregateThumb = row.directUnifiedPoster || aggregateThumb;
                aggregateYear = row.directUnifiedYear;
            }
        }

        // Duration / "Valid Play" Check
        // 15% completion rule
        let totalDurationMs = 0;
        // Ideally we'd get duration from Unified Item, but we might not have it loaded fully here beyond basics.
        // Fallback to meta.
        if (meta.duration) totalDurationMs = meta.duration;

        const playedDurationMs = (row.duration || 0) * 1000;

        if (totalDurationMs > 0) {
            if ((playedDurationMs / totalDurationMs) < 0.15) continue;
        } else {
            if (row.duration < 120) continue;
        }


        if (!statsMap.has(aggregateId)) {
            statsMap.set(aggregateId, {
                id: aggregateId,
                title: aggregateTitle,
                thumb: aggregateThumb,
                type: aggregateType,
                year: aggregateYear,
                users: new Set(),
                totalPlays: 0,
                totalDuration: 0
            });
        }

        const stat = statsMap.get(aggregateId)!;
        stat.users.add(row.user);
        stat.totalPlays++;
        stat.totalDuration += row.duration;

        // Keep the "best" thumb (e.g. if we found one now and didn't have one before)
        if (aggregateThumb && (!stat.thumb || stat.thumb.startsWith('/api/proxy'))) {
            // If we have a Unified Poster (URL usually), prefer it over proxy
            if (aggregateThumb.startsWith('http')) stat.thumb = aggregateThumb;
            else if (!stat.thumb) stat.thumb = aggregateThumb;
        }
    }

    return Array.from(statsMap.values()).map(s => ({
        title: s.title,
        ratingKey: s.id, // Use our aggregate ID as the key
        serverId: 'unified',
        uniqueUsers: s.users.size,
        totalPlays: s.totalPlays,
        count: sort === 'total_plays' ? s.totalPlays : s.users.size,
        thumb: s.thumb,
        type: s.type,
        year: s.year
    })).sort((a, b) => b.count - a.count).slice(0, 20); // Top 20
}
