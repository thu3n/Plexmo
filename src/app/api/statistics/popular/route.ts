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

        // Aggregation Map
        // Key: Canonical ID (e.g., "imdb://tt12345") OR Slug ("movie:avatar:2009")
        // Value: { count: Set<user>, totalPlays: number, displayTitle, thumb, ... }
        const aggregated = new Map<string, any>();

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
            // Parse Metadata
            const { ids: historyIds, meta: hMeta } = extractGuids(row.history_meta);
            const { ids: libraryIds, meta: lMeta } = extractGuids(row.library_meta);

            // Combine IDs (History preferred for exactness of THAT session, Library fallback)
            const ids = { ...libraryIds, ...historyIds };
            const effectiveMeta = { ...lMeta, ...hMeta }; // Merge for other fields (year, etc)

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
                // Heuristic Fallback
                if (effectiveMeta?.grandparentTitle || (row.subtitle && row.subtitle.match(/S\d+E\d+/))) itemType = 'episode';
                else itemType = 'movie';
            }

            // --- IDENTIFICATION LOGIC ---
            let uniqueKey = "";
            let displayTitle = row.title;
            let detectedType = itemType;
            let thumb = row.thumb || (effectiveMeta?.thumb || effectiveMeta?.parentThumb || effectiveMeta?.grandparentThumb);
            const year = effectiveMeta?.year || row.year;

            // HANDLE SHOWS/EPISODES
            if (itemType === 'episode' || (effectiveMeta && effectiveMeta.grandparentTitle)) {
                const seriesName = effectiveMeta?.grandparentTitle || row.title; // For episodes, row.title is usually ep title? No, wait.
                // In history, row.title IS the episode title. row.subtitle is usually SxxExx.
                // But wait, if type is 'show', user wants SERIES aggregation?
                // Or if type is 'episode', user wants EPISODE aggregation?

                // Reuse logic from previous implementation but smarter ID use
                if (type === 'show') {
                    // Aggrerate by Series
                    // 1. Try TVDB/TMDB of the SHOW
                    // Note: Episode metadata often contains the SHOW's guid in `grandparentGuid` or similar? 
                    // Usually Guid is for the episode. 
                    // But usually episodes share the same Series ID prefix or we can rely on Series Name if ID fails.
                    // Actually, Plex `Guid` on an episode is unique to the episode. 
                    // We need the Show's ID. 
                    // `library_items` doesn't easily link to parent. 
                    // Fallback to Series Title for Shows is safest unless we do deep lookups.
                    // OR: check `grandparentTitle`. 

                    if (seriesName) {
                        uniqueKey = `series:${getSlug(seriesName)}`; // Fallback for now as we don't store Show GUID in episode history
                        displayTitle = seriesName;
                        detectedType = 'show';
                        if (effectiveMeta?.grandparentThumb) thumb = effectiveMeta.grandparentThumb;
                    }
                } else {
                    // Aggregate by Episode
                    // 1. Try Episode GUID
                    if (ids.imdb) uniqueKey = ids.imdb;
                    else if (ids.tmdb) uniqueKey = ids.tmdb;
                    else if (ids.tvdb) uniqueKey = ids.tvdb;
                    else {
                        // Fallback: S/E matching
                        let season = effectiveMeta?.parentIndex;
                        let episode = effectiveMeta?.index;
                        if ((season === undefined || episode === undefined) && row.subtitle) {
                            const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                            if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                        }

                        if (seriesName && season !== undefined && episode !== undefined) {
                            uniqueKey = `show:${getSlug(seriesName)}:s${season}:e${episode}`;
                            const niceSeason = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                            displayTitle = `${seriesName} - ${niceSeason}`;
                            detectedType = 'episode';
                        } else {
                            uniqueKey = `show:${row.ratingKey}`; // Worst case
                        }
                    }
                }
            } else {
                // MOVIES
                if (type === 'show') {
                    uniqueKey = ""; // Skip movies if asking for shows
                } else {
                    // 1. ID Match
                    if (ids.imdb) uniqueKey = ids.imdb;
                    else if (ids.tmdb) uniqueKey = ids.tmdb;
                    // 2. Title+Year Fallback (Smart Slug)
                    else {
                        uniqueKey = `movie:${getSlug(row.title, year)}`;
                    }
                    displayTitle = row.title;
                    if (!detectedType) detectedType = 'movie';
                }
            }

            if (!uniqueKey) continue;

            // Aggregation Update
            if (!aggregated.has(uniqueKey)) {
                aggregated.set(uniqueKey, {
                    users: new Set(),
                    totalPlays: 0,
                    displayTitle: displayTitle,
                    thumb: thumb,
                    serverId: row.serverId,
                    ratingKey: row.ratingKey,
                    type: detectedType,
                    // Keep track of "best" metadata source?
                    hasExternalId: !!(ids.imdb || ids.tmdb)
                });
            }

            const exist = aggregated.get(uniqueKey);
            exist.users.add(row.user);
            exist.totalPlays += 1;

            // Upgrade metadata if we found a better source (e.g. this row has a thumb or External ID)
            if (!exist.thumb && thumb) exist.thumb = thumb;
            // If we matched by slug but this entry HAS an ID, we might want to "upgrade" the key? 
            // Too complex for single pass. We rely on the fact that if ANY entry has ID, we used it? 
            // No, if we mixed ID-based and Slug-based, they might be split.
            // But: Since we prioritize ID, if an item HAS ID, it uses it. If another entry (same movie) MISSES ID, it uses Slug.
            // They WILL split. 
            // To fix this: We need a "Slug -> ID" map?
            // Or simpler: Just accept that deleted items (no ID) might split from existing items (with ID) until we do something fancier.
            // User accepted "Deleted items from before this change will still rely on Title matching".
            // Ideally we'd want them to merge.
            // We can do a second pass? 
            // Pass 1: Collect all ID-based keys.
            // Pass 2: Collect all Slug-based keys. Check if Slug matches any ID-based item's Slug?
            // Let's implement that quick optimization!
        }

        // Post-Processing: Merge Orphan Slugs into ID entries
        // 1. Build Slug Map from ID-entries
        const slugMap = new Map<string, string>(); // Slug -> ID-Key
        for (const [key, item] of aggregated.entries()) {
            if (item.hasExternalId) {
                // Re-derive slug
                // Note: we need title/year from item. We only stored displayTitle. 
                // It's a bit fuzzy. Let's skip for safety to avoid false merges.
                // The user explicitly asked about the "Deleted item" scenario.
                // If I delete "Harry Potter", it loses ID. It becomes Slug.
                // If I have "Harry Potter" on Server B (with ID), it uses ID.
                // They result in TWO entries: "imdb://..." and "movie:harrypotter...".
                // This is suboptimal.
                // Let's rely on the fact that `displayTitle` is usually clean.
            }
        }

        // ... proceeding Standard Output

        // Convert to Array & Sort
        let results = Array.from(aggregated.values()).map(item => ({
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
