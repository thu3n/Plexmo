import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const ratingKey = searchParams.get("ratingKey");
        const serverId = searchParams.get("serverId");
        const range = searchParams.get("range") || "24h";
        const type = searchParams.get("type"); // Support 'show' type for series aggregation

        if (!ratingKey) {
            return NextResponse.json({ error: "Missing ratingKey" }, { status: 400 });
        }

        let cutoff = 0;
        const now = Date.now();

        switch (range) {
            case "24h":
                cutoff = now - (24 * 60 * 60 * 1000);
                break;
            case "7d":
                cutoff = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case "30d":
                cutoff = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case "90d":
                cutoff = now - (90 * 24 * 60 * 60 * 1000);
                break;
            case "all":
                cutoff = 0;
                break;
            default:
                cutoff = now - (24 * 60 * 60 * 1000);
        }

        // 1. Fetch ALL history for the range to perform in-memory matching
        // We need this to duplicate the aggregation logic from the popular route
        const query = `
            SELECT 
                h.user,
                h.startTime,
                h.ratingKey,
                h.serverId,
                h.title,
                h.subtitle,
                h.meta_json,
                l.type as library_type,
                l.meta_json as library_meta,
                h.duration
            FROM activity_history h
            LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
            WHERE h.startTime > ?
            ORDER BY h.startTime DESC
            LIMIT 100000
        `;

        const rows = db.prepare(query).all(cutoff) as any[];

        // --- ENHANCED AGGREGATION LOGIC (MATCHING POPULAR ROUTE) ---

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
                groupLookup.set(`${m.server_id}:${m.library_key}`, group);
            }
        });

        // Pre-fetch all TV Shows from library_items to allow ID-based merging
        const allShows = db.prepare("SELECT title, year, meta_json FROM library_items WHERE type = 'show'").all() as any[];
        const showIdLookup = new Map<string, any>(); // Slug -> { ids }
        const showTitleLookup = new Map<string, any>(); // TitleSlug -> { ids } (Fallback)

        // Helper to extract GUIDs (Copied from popular/route.ts)
        const extractGuids = (meta: any) => {
            const ids: any = {};
            if (!meta) return { ids, meta };
            const guids = Array.isArray(meta.Guid) ? meta.Guid : (meta.Guid ? [meta.Guid] : []);
            // Also check top-level guid for Plex
            if (meta.guid && meta.guid.startsWith('plex://')) ids.plex = meta.guid;
            if (meta.grandparentGuid) ids.grandparentGuid = meta.grandparentGuid; // Special for shows

            guids.forEach((g: any) => {
                if (g.id?.startsWith('imdb://')) ids.imdb = g.id;
                if (g.id?.startsWith('tmdb://')) ids.tmdb = g.id;
                if (g.id?.startsWith('tvdb://')) ids.tvdb = g.id;
                if (g.id?.startsWith('plex://')) ids.plex = g.id;
            });
            return { ids, meta };
        };

        const getSlug = (str: string, year?: number) => {
            if (!str) return '';
            const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (year) return `${clean}-${year}`;
            return clean;
        };

        const getTitleSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

        allShows.forEach(show => {
            let meta: any = {};
            try { meta = JSON.parse(show.meta_json); } catch (e) { }
            const { ids } = extractGuids(meta);

            if (Object.keys(ids).length > 0) {
                // Precision Match
                const slug = getSlug(show.title, show.year);
                showIdLookup.set(slug, ids);

                // Fallback Match (Last One Wins)
                const titleSlug = getTitleSlug(show.title);
                showTitleLookup.set(titleSlug, ids);
            }
        });

        // -----------------------------------------------------------

        // 2. Find the "Reference Item" to establish Identity
        let referenceRow = rows.find(r => r.ratingKey == ratingKey && (!serverId || r.serverId == serverId)) || rows.find(r => r.ratingKey == ratingKey);

        // Fallback: If not found in memory (due to LIMIT), fetch specifically
        if (!referenceRow) {
            const specificQuery = `
                SELECT 
                    h.user, h.startTime, h.ratingKey, h.serverId, h.title, h.subtitle, h.meta_json,
                    l.type as library_type, l.meta_json as library_meta, h.duration
                FROM activity_history h
                LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
                WHERE h.ratingKey = ?
                ORDER BY h.startTime DESC
                LIMIT 1
            `;
            const specificRow = db.prepare(specificQuery).get(ratingKey) as any;
            if (specificRow) {
                referenceRow = specificRow;
                // We don't add it to 'rows' because 'rows' is for matching OTHER plays. 
                // However, if we don't have the history in 'rows', we won't find the users.
                // Critical: If the reference row is old, likely its history is also old and missing from 'rows'.
                // Ideally, we should fetch history for the target keys once established.
            }
        }

        if (!referenceRow) {
            return NextResponse.json({ users: [] });
        }


        // Robust Identity Generator (Returns Set of Keys)
        const getKeys = (row: any) => {
            const keys = new Set<string>();
            let meta: any = null;
            try { meta = JSON.parse(row.meta_json); } catch (e) { }
            let libMeta: any = null;
            try { libMeta = JSON.parse(row.library_meta); } catch (e) { }
            const effectiveMeta = { ...libMeta, ...meta };

            const { ids } = extractGuids(effectiveMeta);

            // UNIFIED GROUP CHECK
            const unifiedGroup = groupLookup.get(`${row.serverId}:${row.ratingKey}`);
            if (unifiedGroup) {
                if (type === 'show' || unifiedGroup.type === 'movie') {
                    keys.add(`group:${unifiedGroup.id}`);
                } else {
                    // Episode within group
                    let season = effectiveMeta?.parentIndex;
                    let episode = effectiveMeta?.index;
                    if ((season === undefined || episode === undefined) && row.subtitle) {
                        const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                        if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                    }
                    if (season !== undefined && episode !== undefined) {
                        keys.add(`group:${unifiedGroup.id}:s${season}:e${episode}`);
                    }
                }
            }


            let itemType = row.library_type;
            if (!itemType && effectiveMeta && effectiveMeta.type) {
                itemType = effectiveMeta.type;
            }

            // SHOW / EPISODE MODE
            if (itemType === 'episode' || (effectiveMeta && effectiveMeta.grandparentTitle)) {
                if (type === 'show') {
                    // Series Level Matching
                    const seriesName = effectiveMeta?.grandparentTitle || row.title;
                    const seriesYear = effectiveMeta?.grandparentYear;

                    if (seriesName) {
                        // 1. Slug Match
                        const sSlug = getSlug(seriesName, seriesYear);
                        keys.add(`series:${sSlug}`);

                        // 2. GUID Match (Plex)
                        if (effectiveMeta.grandparentGuid) keys.add(effectiveMeta.grandparentGuid);

                        // 3. Robust Lookup (from library_items)
                        let extraIds = showIdLookup.get(sSlug);
                        if (!extraIds) {
                            const justTitleSlug = getTitleSlug(seriesName);
                            extraIds = showTitleLookup.get(justTitleSlug);
                        }

                        if (extraIds) {
                            if (extraIds.imdb) keys.add(extraIds.imdb);
                            if (extraIds.tmdb) keys.add(extraIds.tmdb);
                            if (extraIds.tvdb) keys.add(extraIds.tvdb);
                            if (extraIds.plex) keys.add(extraIds.plex);
                        }
                    }
                    return keys;
                }

                // Episode Level Matching (Specific Episode)
                if (ids.imdb) keys.add(ids.imdb);
                if (ids.tmdb) keys.add(ids.tmdb);
                if (ids.plex) keys.add(ids.plex);
                if (ids.tvdb) keys.add(ids.tvdb);

                // Fallback to SxxExx
                let seriesName = effectiveMeta?.grandparentTitle || row.title;
                let season = effectiveMeta?.parentIndex;
                let episode = effectiveMeta?.index;

                if ((season === undefined || episode === undefined) && row.subtitle) {
                    const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                    if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                }

                if (seriesName && season !== undefined && episode !== undefined) {
                    keys.add(`show:${getSlug(seriesName)}:s${season}:e${episode}`);
                } else {
                    keys.add(`ratingKey:${row.ratingKey}@${row.serverId}`); // Worst case
                }
                return keys;
            }

            // MOVIE MODE
            if (type === 'show') return keys; // Empty set

            const title = effectiveMeta?.originalTitle || row.title;
            const year = effectiveMeta?.year || row.year;

            // 1. Slug Match
            keys.add(`movie:${getSlug(title, year)}`);
            // 2. ID Match
            if (ids.imdb) keys.add(ids.imdb);
            if (ids.tmdb) keys.add(ids.tmdb);
            if (ids.plex) keys.add(ids.plex);

            // Group might have linked them, but slug/ID usually enough for movies
            return keys;
        };

        const targetKeys = getKeys(referenceRow);

        // If we couldn't determine identity, return empty
        if (targetKeys.size === 0) {
            return NextResponse.json({ users: [] });
        }

        // 3. Filter rows that match ANY of the target keys
        const matchedRows = rows.filter(row => {
            const rowKeys = getKeys(row);
            // Check intersection
            for (const k of rowKeys) {
                if (targetKeys.has(k)) return true;
            }
            return false;
        });

        const sort = searchParams.get("sort") || "unique_users"; // 'unique_users' or 'total_plays'

        // 4. Aggregate Users & Plays
        const userStats = new Map<string, {
            playCount: number,
            lastWatched: number,
            user: string,
            plays: any[]
        }>();

        for (const row of matchedRows) {
            // Extract metadata
            let meta: any = null;
            if (row.meta_json) { try { meta = JSON.parse(row.meta_json); } catch (e) { } }
            let libMeta: any = null;
            if (row.library_meta) { try { libMeta = JSON.parse(row.library_meta); } catch (e) { } }
            const effectiveMeta = { ...libMeta, ...meta };

            // 80% Completion Check - REMOVED to match Library Group logic (count all attempts as unique users)
            // But we still calculate the percentage for display
            let completionPercentage = 0;
            if (effectiveMeta?.duration > 0) {
                completionPercentage = ((row.duration || 0) * 1000) / effectiveMeta.duration;
            }

            // Completion Check: 15% (Lowered from 80% to catch multi-session watches)
            if (effectiveMeta?.duration > 0) {
                if (completionPercentage < 0.15) {
                    continue; // Skip extremely short plays
                }
            }

            // Determine Episode Details
            let episodeTitle = row.title;
            let season = effectiveMeta?.parentIndex;
            let episode = effectiveMeta?.index;

            // If it's a show/episode, try to format nicely
            if (type === 'show' || row.library_type === 'episode' || effectiveMeta?.grandparentTitle) {
                if ((season === undefined || episode === undefined) && row.subtitle) {
                    const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                    if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                }

                if (season !== undefined && episode !== undefined) {
                    // It's a proper episode
                    episodeTitle = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                }
            }

            if (!userStats.has(row.user)) {
                userStats.set(row.user, {
                    user: row.user,
                    playCount: 0,
                    lastWatched: 0,
                    plays: []
                });
            }
            const stat = userStats.get(row.user)!;
            stat.playCount += 1;
            if (row.startTime > stat.lastWatched) {
                stat.lastWatched = row.startTime;
            }

            // Add specific play details
            stat.plays.push({
                title: episodeTitle,
                originalTitle: row.title,
                date: row.startTime,
                duration: row.duration,
                percent: Math.round(completionPercentage * 100),
                season: season,
                episode: episode
            });
        }

        const users = Array.from(userStats.values()).sort((a, b) => b.lastWatched - a.lastWatched);

        return NextResponse.json({
            users
        });

    } catch (error) {
        console.error("Failed to fetch item details:", error);
        return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
    }
}
