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
            LIMIT 100000
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
                    if (g.id?.startsWith('plex://')) ids.plex = g.id;
                });
                return { ids, meta };
            } catch (e) { return { ids: {}, meta: null }; }
        };

        const getSlug = (title: string, year?: string | number) => {
            const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            return `${cleanTitle}-${year || 'xxxx'}`;
        };

        // Pre-fetch all TV Shows from library_items to allow ID-based merging for Episodes
        // even if history logs don't have the IDs or have different names.
        const allShows = db.prepare("SELECT title, year, meta_json FROM library_items WHERE type = 'show'").all() as any[];
        const showIdLookup = new Map<string, any>(); // Slug -> { ids }
        const showTitleLookup = new Map<string, any>(); // TitleSlug -> { ids } (Fallback)

        const getTitleSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

        allShows.forEach(show => {
            const { ids } = extractGuids(show.meta_json);
            if (Object.keys(ids).length > 0) {
                // Precision Match
                const slug = getSlug(show.title, show.year);
                showIdLookup.set(slug, ids);

                // Fallback Match (Last One Wins, usually fine for unique titles)
                const titleSlug = getTitleSlug(show.title);
                showTitleLookup.set(titleSlug, ids);
            }
        });

        for (const row of rows) {
            // CHECK UNIFIED GROUP FIRST
            const unifiedGroup = groupLookup.get(`${row.serverId}:${row.ratingKey}`);

            // Parse Metadata
            const { ids: historyIds, meta: hMeta } = extractGuids(row.history_meta);
            const { ids: libraryIds, meta: lMeta } = extractGuids(row.library_meta);

            // Combine IDs and Meta
            const ids = { ...libraryIds, ...historyIds };
            const effectiveMeta = { ...lMeta, ...hMeta };

            // Completion Check: 15% (Lowered from 80% to catch multi-session watches like Traacker263)
            // Traacker263 had sessions of ~16%, ~60%, ~20%. A 15% filter captures them.
            const playedDurationMs = (row.duration || 0) * 1000;
            const totalDurationMs = effectiveMeta?.duration || 0;

            if (totalDurationMs > 0) {
                const percentage = playedDurationMs / totalDurationMs;

                // DEBUG: Inspect Traacker263
                if (row.user === 'Traacker263') {
                    // Debug removed
                }

                if (percentage < 0.15) continue;
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
                        const seriesYear = effectiveMeta?.grandparentYear;
                        const sSlug = getSlug(seriesName, seriesYear);
                        itemKeys.add(`series:${sSlug}`); // Slug Key

                        // CORE FIX: Match by Grandparent GUID (Plex Universal ID) if available
                        if (effectiveMeta?.grandparentGuid) {
                            itemKeys.add(effectiveMeta.grandparentGuid);
                        }

                        // ID-based Lookup for Shows
                        let extraIds = showIdLookup.get(sSlug);
                        if (!extraIds) {
                            // Try Fallback (Title Only)
                            // We need to re-generate strictly title slug here
                            const justTitleSlug = getTitleSlug(seriesName);
                            extraIds = showTitleLookup.get(justTitleSlug);
                        }

                        if (extraIds) {
                            if (extraIds.imdb) itemKeys.add(extraIds.imdb);
                            if (extraIds.tmdb) itemKeys.add(extraIds.tmdb);
                            if (extraIds.tvdb) itemKeys.add(extraIds.tvdb);
                            if (extraIds.plex) itemKeys.add(extraIds.plex);
                        }

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
                    if (ids.imdb) itemKeys.add(ids.imdb);
                    if (ids.tmdb) itemKeys.add(ids.tmdb);
                    if (ids.tvdb) itemKeys.add(ids.tvdb);
                    if (ids.plex) itemKeys.add(ids.plex);

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
                if (ids.plex) itemKeys.add(ids.plex);
                // Slug Fallback
                const slugKey = `movie:${getSlug(row.title, year)}`;
                itemKeys.add(slugKey);

                itemKeys.add(slugKey);

                detectedType = 'movie';
            }

            if (itemKeys.size === 0) continue;

            // TRANSITIVE MATCHING (Robust Merge)
            // 1. Find all existing items that this row matches
            const matchedItems = new Set<any>();
            for (const key of itemKeys) {
                if (mergedMap.has(key)) {
                    matchedItems.add(mergedMap.get(key));
                }
            }

            let primaryItem: any = undefined;

            if (matchedItems.size > 0) {
                // We found matches. If > 1, we must merge them together!
                const matchesArray = Array.from(matchedItems);
                primaryItem = matchesArray[0];

                if (matchedItems.size > 1) {
                    // Merge secondary items into primary
                    for (let i = 1; i < matchesArray.length; i++) {
                        const victim = matchesArray[i];
                        if (victim === primaryItem) continue;

                        // Absorb users and plays
                        victim.users.forEach((u: string) => primaryItem.users.add(u));
                        primaryItem.totalPlays += victim.totalPlays;

                        // Absorb keys: We must find all keys pointing to victim and point them to primary
                        // This is expensive to search map values. 
                        // Optimization: We rely on the fact that we only encounter keys via iteration.
                        // But strictly, we should update the map. 
                        // A better way: Items could verify their identity? 
                        // For this scope (5000 rows), we can just re-map keys seen *so far*? 
                        // No, that's hard.
                        // Actually, since we only map keys -> Object, we just need to ensure future lookups find Primary.
                        // BUT, we don't know *which* keys point to Victim.
                        // However, we DO know the keys of the Current Row connected them.
                        // Is it possible other keys point to Victim? Yes.
                        // Simplification: We accept that old keys pointing to Victim are "dead" for now unless we do a reverse lookup map.
                        // BUT, `items` Set must remove Victim.
                        items.delete(victim);
                    }

                    // CRITICAL: We need to inform the map that keys pointing to Victims now point to Primary.
                    // Doing a full map scan is O(MapSize). For 5000 rows, MapSize ~5000. Acceptable?
                    // 5000 iterations is nothing in JS.
                    mergedMap.forEach((val, key) => {
                        if (matchedItems.has(val) && val !== primaryItem) {
                            mergedMap.set(key, primaryItem);
                        }
                    });
                }
            }

            if (primaryItem) {
                // Merge current row into Primary
                primaryItem.users.add(row.user);
                primaryItem.totalPlays += 1;

                // Map new keys to Primary
                for (const key of itemKeys) {
                    if (!mergedMap.has(key) || mergedMap.get(key) !== primaryItem) {
                        mergedMap.set(key, primaryItem);
                    }
                }

                // Metadata Upgrade
                if (!primaryItem.thumb && thumb) primaryItem.thumb = thumb;

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
