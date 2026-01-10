import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let ratingKey = searchParams.get("ratingKey");
        const serverId = searchParams.get("serverId");
        let unifiedItemId = searchParams.get("unifiedItemId");
        const range = searchParams.get("range") || "24h";

        // Check if ratingKey is actually a Unified UUID (Frontend Quirks)
        if (!unifiedItemId && ratingKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ratingKey)) {
            console.log(`[History] Detected UUID in ratingKey, switching to Unified Mode: ${ratingKey}`);
            unifiedItemId = ratingKey;
            ratingKey = null; // Ensure we don't fall into Legacy Mode
        }

        if (!ratingKey && !unifiedItemId) {
            return NextResponse.json({ error: "Missing ratingKey or unifiedItemId" }, { status: 400 });
        }

        console.log(`[History] Fetching for ratingKey=${ratingKey}, unifiedItemId=${unifiedItemId}, range=${range}`);

        // 1. Calculate Cutoff
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

        // 2. Resolve Target Items
        let targetItems: { ratingKey: string, serverId: string }[] = [];
        let mode = "SINGLE"; // SINGLE, UNIFIED, SHOW_EXPANDED

        if (unifiedItemId) {
            mode = "UNIFIED";
            // A. Find all items directly linked to this Unified ID
            const directItems = db.prepare(`
                SELECT ratingKey, serverId, type 
                FROM library_items 
                WHERE unifiedItemId = ?
            `).all(unifiedItemId) as { ratingKey: string, serverId: string, type: string }[];

            targetItems.push(...directItems.map(i => ({ ratingKey: i.ratingKey, serverId: i.serverId })));

            // B. If any are shows, expand to find their episodes
            for (const item of directItems) {
                if (item.type === 'show') {
                    mode = "SHOW_EXPANDED";
                    // Find episodes belonging to this show
                    // We match serverId AND (grandparentRatingKey = showKey OR parentRatingKey = showKey)
                    const episodes = db.prepare(`
                        SELECT ratingKey, serverId 
                        FROM library_items 
                        WHERE serverId = ? 
                        AND type = 'episode'
                        AND (
                            json_extract(meta_json, '$.grandparentRatingKey') = ? 
                            OR json_extract(meta_json, '$.parentRatingKey') = ?
                        )
                    `).all(item.serverId, item.ratingKey, item.ratingKey) as { ratingKey: string, serverId: string }[];

                    targetItems.push(...episodes);
                }
            }

        } else if (ratingKey) {
            // Handle Single / Special Key Logic
            if (ratingKey.startsWith('show_title:') || ratingKey.startsWith('show_title_orphan:')) {
                // SPECIAL: Show Title Aggregation (Legacy/Fallback)
                const prefix = ratingKey.startsWith('show_title_orphan:') ? 'show_title_orphan:' : 'show_title:';
                const title = decodeURIComponent(ratingKey.substring(prefix.length));
                const episodes = db.prepare(`
                    SELECT ratingKey, serverId 
                    FROM library_items 
                    WHERE type = 'episode' 
                    AND (json_extract(meta_json, '$.grandparentTitle') = ? OR json_extract(meta_json, '$.showTitle') = ?)
                `).all(title, title) as { ratingKey: string, serverId: string }[];
                targetItems = episodes;
                mode = "SHOW_TITLE_MATCH";

            } else if (ratingKey.startsWith('orphan:')) {
                // SPECIAL: Orphan ID
                const parts = ratingKey.split(':');
                if (parts.length === 3) {
                    const serverId = parts[1];
                    const rKey = parts[2];

                    // Check if it's a show/episode
                    const item = db.prepare("SELECT type, meta_json FROM library_items WHERE ratingKey = ? AND serverId = ?").get(rKey, serverId) as any;

                    if (item && item.type === 'episode') {
                        try {
                            const meta = JSON.parse(item.meta_json);
                            const showTitle = meta.grandparentTitle || meta.showTitle;
                            if (showTitle) {
                                // Fallback to Title Match for Orphan Show Episodes
                                const episodes = db.prepare(`
                                    SELECT ratingKey, serverId 
                                    FROM library_items 
                                    WHERE type = 'episode' 
                                    AND (json_extract(meta_json, '$.grandparentTitle') = ? OR json_extract(meta_json, '$.showTitle') = ?)
                                `).all(showTitle, showTitle) as { ratingKey: string, serverId: string }[];
                                targetItems = episodes;
                                mode = "ORPHAN_SHOW_TITLE";
                            } else {
                                targetItems.push({ ratingKey: rKey, serverId: serverId });
                            }
                        } catch (e) { targetItems.push({ ratingKey: rKey, serverId: serverId }); }

                    } else if (item && item.type === 'show') {
                        // Expand Orphan Show
                        const episodes = db.prepare(`
                            SELECT ratingKey, serverId 
                            FROM library_items 
                            WHERE serverId = ? 
                            AND type = 'episode'
                            AND (
                                json_extract(meta_json, '$.grandparentRatingKey') = ? 
                                OR json_extract(meta_json, '$.parentRatingKey') = ?
                            )
                        `).all(serverId, rKey, rKey) as { ratingKey: string, serverId: string }[];
                        targetItems.push(...episodes);
                        mode = "ORPHAN_SHOW_EXPANDED";
                    } else {
                        targetItems.push({ ratingKey: rKey, serverId: serverId });
                    }
                }

            } else {
                // Standard Single Item (Check if it maps to Unified First?)
                // Strategy: Just add it. If it's part of a unified group, the frontend usually calls with unifiedItemId.
                // If the frontend called with ratingKey, it prob meant specific item or pre-unified state.
                targetItems.push({ ratingKey: ratingKey, serverId: serverId || '' });
            }
        }

        // 3. De-duplicate Target Items
        const uniqueKeys = new Set<string>();
        const finalTargets: { ratingKey: string, serverId: string }[] = [];
        for (const t of targetItems) {
            const k = `${t.serverId}:${t.ratingKey}`;
            if (!uniqueKeys.has(k)) {
                uniqueKeys.add(k);
                finalTargets.push(t);
            }
        }

        // 4. Execute History Query
        let historyRows: any[] = [];

        if (finalTargets.length > 0) {
            // Build simple WHERE OR clause (sqlite doesn't support tuple IN ( (a,b), (c,d) ) well in all versions/bindings)
            // safer to do: WHERE (ratingKey=? AND serverId=?) OR (ratingKey=? AND serverId=?) ...
            // Limit strictness: 1000 items max to prevent SQL overload?
            const slicedTargets = finalTargets.slice(0, 500);

            const whereClauses = slicedTargets.map(() => `(h.ratingKey = ? AND h.serverId = ?)`).join(' OR ');
            const queryParams = slicedTargets.flatMap(t => [t.ratingKey, t.serverId]);

            const query = `
                SELECT 
                    h.user,
                    h.startTime,
                    h.ratingKey,
                    h.serverId,
                    h.title,
                    h.subtitle,
                    h.meta_json,
                    h.duration,
                    l.thumb
                FROM activity_history h
                LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
                WHERE h.startTime > ?
                AND (${whereClauses})
                ORDER BY h.startTime DESC
                LIMIT 50000
            `;

            historyRows = db.prepare(query).all(cutoff, ...queryParams) as any[];
        } else if (mode === "SHOW_TITLE_MATCH" && ratingKey) {
            // Fallback for Orphan Shows (No items found in Library, search History directly)
            const prefix = ratingKey.startsWith('show_title_orphan:') ? 'show_title_orphan:' : 'show_title:';
            const title = decodeURIComponent(ratingKey.substring(prefix.length));

            const query = `
                SELECT 
                    h.user, h.startTime, h.ratingKey, h.serverId, h.title, h.subtitle, h.meta_json, h.duration, l.thumb
                FROM activity_history h
                LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
                WHERE h.startTime > ?
                AND (json_extract(h.meta_json, '$.grandparentTitle') = ? OR json_extract(h.meta_json, '$.showTitle') = ?)
                ORDER BY h.startTime DESC
                LIMIT 50000
            `;
            historyRows = db.prepare(query).all(cutoff, title, title) as any[];
            console.log(`[History] Orphan Fallback: Found ${historyRows.length} rows for title '${title}'`);
        }

        console.log(`[History] Mode: ${mode}, Found ${finalTargets.length} keys, Resolved ${historyRows.length} rows.`);

        // 3. Process & Aggregate Users
        const userStats = new Map<string, {
            playCount: number,
            lastWatched: number,
            user: string,
            plays: any[]
        }>();

        for (const row of historyRows) {
            let meta: any = null;
            try { meta = JSON.parse(row.meta_json || '{}'); } catch (e) { }

            let duration = meta.duration || 0;
            if (!duration && row.duration) duration = row.duration;

            let completionPercentage = 0;
            if (duration > 0) {
                completionPercentage = ((row.duration || 0) * 1000) / duration;
            }

            // Filter out short plays / non-significant plays
            if (duration > 0 && completionPercentage < 0.15) continue;
            if (duration === 0 && (row.duration || 0) < 120) continue;

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
            if (row.startTime > stat.lastWatched) stat.lastWatched = row.startTime;

            stat.plays.push({
                title: row.title,
                originalTitle: row.title,
                date: row.startTime,
                duration: row.duration,
                percent: duration > 0 ? Math.round(completionPercentage * 100) : 0,
                season: meta.parentIndex,
                episode: meta.index
            });
        }

        const users = Array.from(userStats.values()).sort((a, b) => b.lastWatched - a.lastWatched);

        // 4. Fetch Files (Best Effort)
        // We only fetch files if we have a unified ID or single item, harder for aggregated shows unless we query all episodes
        let files: any[] = [];

        // Only fetch files if we can easily identify the source items
        let fileSourceItems: any[] = [];
        // Limit file fetching to avoid overloading response for shows with many episodes
        fileSourceItems = targetItems;
        // Limit file fetching to avoid overloading response for shows with many episodes
        if (fileSourceItems.length > 20) {
            fileSourceItems = fileSourceItems.slice(0, 20);
        }
        // For SHOW mode, we might have too many files, so maybe skip or limit? 
        // Let's trying fetching distinct files for the show if possible, but might be heavy.
        // For now, let's leave files empty for aggregated show views to avoid fetching 100s of episodes' file info.

        for (const item of fileSourceItems) {
            const libItem = db.prepare("SELECT meta_json, serverId FROM library_items WHERE ratingKey = ? AND serverId = ?").get(item.ratingKey, item.serverId) as any;
            const server = db.prepare("SELECT name FROM servers WHERE id = ?").get(item.serverId) as any;
            const serverName = server?.name || "Unknown Server";

            if (libItem && libItem.meta_json) {
                try {
                    const meta = JSON.parse(libItem.meta_json);
                    if (meta.Media) {
                        for (const media of meta.Media) {
                            const resolution = media.videoResolution || 'Unknown';
                            const width = media.width;
                            if (media.Part) {
                                for (const part of media.Part) {
                                    files.push({
                                        serverName,
                                        resolution: width ? `${width}p` : resolution,
                                        quality: media.videoProfile,
                                        fileName: part.file ? part.file.split(/[\\/]/).pop() : "Unknown File",
                                        codec: media.videoCodec,
                                        container: media.container,
                                        ratingKey: item.ratingKey // Useful debugging
                                    });
                                }
                            }
                        }
                    }
                } catch (e) { }
            }
        }


        return NextResponse.json({ users, files });

    } catch (error) {
        console.error("Failed to fetch item details:", error);
        return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
    }
}
