import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const range = searchParams.get("range") || "24h";
        const type = searchParams.get("type"); // 'movie', 'episode', or 'show'
        const sort = searchParams.get("sort") || "unique_users"; // 'unique_users' or 'total_plays'

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

        // Fetch aggregation data
        // We join library_items to get Metadata if available (Stage 2)
        const query = `
            SELECT 
                h.title, 
                h.ratingKey, 
                h.serverId,
                h.meta_json as history_meta,
                h.subtitle,
                l.thumb,
                l.type as library_type,
                l.meta_json as library_meta,
                h.user,
                h.duration,
                h.startTime
            FROM activity_history h
            LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
            WHERE h.startTime > ? 
            ORDER BY h.startTime DESC
            LIMIT 5000
        `;

        const rows = db.prepare(query).all(cutoff) as any[];

        // Fetch Unified Groups for priority merging
        const groups = db.prepare("SELECT * FROM library_groups").all() as any[];
        const groupMembers = db.prepare("SELECT * FROM library_group_members").all() as any[];

        // Map: `${serverId}:${ratingKey}` -> GroupObject
        const groupLookup = new Map<string, any>();
        const groupMap = new Map<string, any>(); // id -> group

        groups.forEach(g => groupMap.set(g.id, g));

        groupMembers.forEach(m => {
            const group = groupMap.get(m.group_id);
            if (group) {
                // Determine if member key is numeric (ratingKey) or string? 
                // In library_group_members, library_key stores ratingKey (usually).
                groupLookup.set(`${m.server_id}:${m.library_key}`, group);
            }
        });

        // Aggregation Logic with Transitive Matching
        // We use a map where multiple keys (IMDB, TMDB, Slug) can point to the SAME item object.
        const mergedMap = new Map<string, any>();
        const items = new Set<any>(); // Keep track of unique item objects

        // Helper to extract GUIDs from meta_json
        const extractGuids = (jsonStr: string | null) => {
            if (!jsonStr) return {};
            try {
                const meta = JSON.parse(jsonStr);
                const guids = Array.isArray(meta.Guid) ? meta.Guid : (meta.Guid ? [meta.Guid] : []);
                const ids: any = {};
                guids.forEach((g: any) => {
                    if (g.id?.startsWith('imdb://')) ids.imdb = g.id;
                    if (g.id?.startsWith('tmdb://')) ids.tmdb = g.id;
                    if (g.id?.startsWith('tvdb://')) ids.tvdb = g.id;
                });
                return { ids, meta };
            } catch (e) { return { ids: {}, meta: null }; }
        };

        const getSlug = (title: string, year?: string | number) => {
            const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            return `${cleanTitle}-${year || 'xxxx'}`;
        };

        for (const row of rows) {
            // CHECK UNIFIED GROUP FIRST
            const unifiedGroup = groupLookup.get(`${row.serverId}:${row.ratingKey}`);

            // Parse Metadata
            const { ids: historyIds, meta: hMeta } = extractGuids(row.history_meta);
            const { ids: libraryIds, meta: lMeta } = extractGuids(row.library_meta);

            // Combine IDs and Meta
            const ids = { ...libraryIds, ...historyIds };
            const effectiveMeta = { ...lMeta, ...hMeta };

            // 80% Completion Check
            const playedDurationMs = (row.duration || 0) * 1000;
            const totalDurationMs = effectiveMeta?.duration || 0;

            if (totalDurationMs > 0) {
                const percentage = playedDurationMs / totalDurationMs;
                if (percentage < 0.8) continue;
            }

            // Determine Type
            let itemType = row.library_type || effectiveMeta?.type;
            if (!itemType) {
                if (effectiveMeta?.grandparentTitle || (row.subtitle && row.subtitle.match(/S\d+E\d+/))) itemType = 'episode';
                else itemType = 'movie';
            }

            // Keys Collection for this Item
            const itemKeys = new Set<string>();
            let displayTitle = row.title;
            let thumb = row.thumb || (effectiveMeta?.thumb || effectiveMeta?.parentThumb || effectiveMeta?.grandparentThumb);
            let detectedType = itemType;
            const year = effectiveMeta?.year || row.year;

            // PRIORITY: UNIFIED GROUP
            if (unifiedGroup) {
                // For movies, just group by the Group ID.
                // For Shows, we still need to respect "Episode" view if requested.
                if (type === 'show' || unifiedGroup.type === 'movie') {
                    // Viewing Shows or Movies -> Group is the key
                    itemKeys.add(`group:${unifiedGroup.id}`);
                    displayTitle = unifiedGroup.name; // Use Group Name!
                    // We don't change thumb here unless we stored a group thumb? 
                    // Typically use item's thumb.
                } else {
                    // Viewing Episodes but item is in a Show Group?
                    // We need to resolve to `Group:Episode`.
                    // This requires we know the S/E of this row relative to the group.
                    // The group itself is just the SHOW container.
                    // So we use `group:{id}:s{s}e{e}` logic.

                    let season = effectiveMeta?.parentIndex;
                    let episode = effectiveMeta?.index;
                    if ((season === undefined || episode === undefined) && row.subtitle) {
                        const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                        if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                    }
                    if (season !== undefined && episode !== undefined) {
                        const slugKey = `group:${unifiedGroup.id}:s${season}:e${episode}`;
                        itemKeys.add(slugKey);
                        const niceSeason = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                        displayTitle = `${unifiedGroup.name} - ${niceSeason}`;
                    }
                }
            }

            // GENERIC KEYS (Fallback & Merging)
            if (itemType === 'episode' || (effectiveMeta && effectiveMeta.grandparentTitle)) {
                const seriesName = effectiveMeta?.grandparentTitle || row.title;
                if (type === 'show') {
                    // SHOW AGGREGATION
                    if (seriesName) {
                        itemKeys.add(`series:${getSlug(seriesName)}`); // Slug Key
                        // Ideally we'd add TMDB/TVDB for the SHOW here if we had it.
                        // But we mostly rely on series name slug for history aggregation.
                        if (!unifiedGroup) displayTitle = seriesName; // Only override title if NOT grouped
                        detectedType = 'show';
                        if (effectiveMeta?.grandparentThumb) thumb = effectiveMeta.grandparentThumb;
                    }
                } else {
                    // EPISODE AGGREGATION
                    let season = effectiveMeta?.parentIndex;
                    let episode = effectiveMeta?.index;
                    // Fallback to regex
                    if ((season === undefined || episode === undefined) && row.subtitle) {
                        const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                        if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                    }

                    if (ids.imdb) itemKeys.add(ids.imdb);
                    if (ids.tmdb) itemKeys.add(ids.tmdb);
                    if (ids.tvdb) itemKeys.add(ids.tvdb);

                    if (season !== undefined && episode !== undefined && seriesName) {
                        const slugKey = `show:${getSlug(seriesName)}:s${season}:e${episode}`;
                        itemKeys.add(slugKey);
                        if (!unifiedGroup) {
                            const niceSeason = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                            displayTitle = `${seriesName} - ${niceSeason}`;
                        }
                        detectedType = 'episode';
                    } else {
                        // Worst case
                        itemKeys.add(`ratingKey:${row.ratingKey}@${row.serverId}`);
                    }
                }
            } else {
                // MOVIE AGGREGATION
                if (type === 'show') continue; // Skip movies

                if (ids.imdb) itemKeys.add(ids.imdb);
                if (ids.tmdb) itemKeys.add(ids.tmdb);
                // Slug Fallback
                const slugKey = `movie:${getSlug(row.title, year)}`;
                itemKeys.add(slugKey);

                detectedType = 'movie';
            }

            if (itemKeys.size === 0) continue;

            // TRANSITIVE MATCHING
            // Check if ANY of our keys point to an existing item
            let match: any = undefined;
            for (const key of itemKeys) {
                if (mergedMap.has(key)) {
                    match = mergedMap.get(key);
                    break;
                }
            }

            if (match) {
                // Existing Item Found -> Merge
                match.users.add(row.user);
                match.totalPlays += 1;

                // Map ALL new keys to this existing item (Expansion)
                for (const key of itemKeys) {
                    if (!mergedMap.has(key)) {
                        mergedMap.set(key, match);
                    }
                }

                // Metadata Upgrade (optional)
                if (!match.thumb && thumb) match.thumb = thumb;
                // If the new row has IDs but the match didn't, we effectively just enriched the match via the new keys.

            } else {
                // New Item
                const newItem = {
                    users: new Set([row.user]),
                    totalPlays: 1,
                    displayTitle,
                    thumb,
                    serverId: row.serverId,
                    ratingKey: row.ratingKey,
                    type: detectedType
                };

                items.add(newItem);
                for (const key of itemKeys) {
                    mergedMap.set(key, newItem);
                }
            }
        }
        // End of Loop - 'items' Set now contains unique, merged objects.


        // Convert to Array & Sort
        let results = Array.from(items).map((item: any) => ({
            title: item.displayTitle,
            ratingKey: item.ratingKey,
            serverId: item.serverId,
            uniqueUsers: item.users.size,
            totalPlays: item.totalPlays,
            count: sort === 'total_plays' ? item.totalPlays : item.users.size,
            thumb: item.thumb ? `/api/image?path=${encodeURIComponent(item.thumb)}&serverId=${item.serverId}` : null,
            type: item.type
        }));

        if (type) {
            results = results.filter(item => item.type === type);
        }

        results.sort((a, b) => b.count - a.count);
        const data = results.slice(0, 10);

        return NextResponse.json({
            range,
            data
        });

    } catch (error) {
        console.error("Failed to fetch popular stats:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
