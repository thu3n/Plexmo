
import { db } from "./db";
import { buildUnifiedItemMap, type MergedItem } from "./library_groups";

type MediaStatEntry = {
    id: string; // Unified GUID
    title: string;
    year?: number;
    poster?: string;
    type: 'movie' | 'show' | 'episode';
    totalPlays: number;
    uniqueUsers: number;
    totalDuration: number;
    firstSeen: string;
    lastSeen: string;
    serverIds: Set<string>;
    userIds: Set<string>; // Temporary for calculation
};

import { updateJob } from "./jobs";

export async function reconcileStatistics(jobId?: string) {
    console.log("[Stats] Starting Reconciliation...");
    if (jobId) updateJob(jobId, { status: 'running', progress: 0, message: 'Starting reconciliation...' });
    
    const startTime = Date.now();

    try {
        // 1. Fetch ALL Library Items to build the Unified Map
        // We need to know: serverId + ratingKey -> UnifiedID
        if (jobId) updateJob(jobId, { progress: 10, message: 'Loading library items...' });
        const libraryItems = db.prepare("SELECT * FROM library_items").all() as any[];
        console.log(`[Stats] Loaded ${libraryItems.length} library items for unification.`);

        // 2. Build Unified Map
        // usage: mergedMap.values() = the unified items
        // But we need a reverse lookup: [serverId:ratingKey] -> UnifiedItem
        if (jobId) updateJob(jobId, { progress: 20, message: 'Building unified map...' });
        const unifiedItemsMap = buildUnifiedItemMap(libraryItems);

        const reverseLookup = new Map<string, MergedItem>(); // [serverId:ratingKey] -> MergedItem

        // Scan unified items to build reverse lookup
        const uniqueHelper = new Set<MergedItem>();

        for (const item of unifiedItemsMap.values()) {
            if (uniqueHelper.has(item)) continue;
            uniqueHelper.add(item);

            for (const source of item.sources) {
                const key = `${source.serverId}:${source.ratingKey}`;
                reverseLookup.set(key, item);
            }
        }

        console.log(`[Stats] Built Unified Map. Found ${uniqueHelper.size} unique entities from ${libraryItems.length} items.`);

        // 3. Process History
        if (jobId) updateJob(jobId, { progress: 40, message: 'Processing viewing history...' });
        const history = db.prepare("SELECT * FROM activity_history").all() as any[];
        console.log(`[Stats] Processing ${history.length} history entries...`);

        const statsMap = new Map<string, MediaStatEntry>();

        let matchedCount = 0;
        let fallbackCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < history.length; i++) {
            const entry = history[i];
            
            // Optional: Update detailed progress every 1000 items
            if (jobId && i % 1000 === 0 && history.length > 5000) {
                 const pct = 40 + Math.floor((i / history.length) * 40); // 40% to 80%
                 updateJob(jobId, { progress: pct, message: `Processing history (${i}/${history.length})...` });
            }

            let unifiedId: string | undefined;
            let unifiedItem: MergedItem | undefined;

            // A. Direct Match via Library
            const key = `${entry.serverId}:${entry.ratingKey}`;
            if (reverseLookup.has(key)) {
                unifiedItem = reverseLookup.get(key);
                unifiedId = unifiedItem?.id;
                matchedCount++;
            }

            // B. Fallback: Parse History Meta (for deleted content)
            if (!unifiedId && entry.meta_json) {
                try {
                    const meta = JSON.parse(entry.meta_json);
                    // Try to extract GUID
                    if (meta.Guid) {
                        const guids = Array.isArray(meta.Guid) ? meta.Guid : [meta.Guid];
                        const imdb = guids.find((g: any) => g.id?.startsWith('imdb://'))?.id;
                        const tmdb = guids.find((g: any) => g.id?.startsWith('tmdb://'))?.id;
                        const plex = guids.find((g: any) => g.id?.startsWith('plex://'))?.id;

                        unifiedId = imdb || tmdb || plex;

                        // If we found an ID, check if we have a unified item for it already?
                        if (unifiedId && unifiedItemsMap.has(unifiedId)) {
                            unifiedItem = unifiedItemsMap.get(unifiedId);
                            unifiedId = unifiedItem?.id || unifiedId;
                        }
                    }
                    if (unifiedId) fallbackCount++;
                } catch (e) { }
            }

            if (!unifiedId) {
                // Last resort: Slug?
                const slug = `${entry.title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${entry.year || 'xxxx'}`;
                if (unifiedItemsMap.has(slug)) {
                    unifiedItem = unifiedItemsMap.get(slug);
                    unifiedId = unifiedItem?.id;
                }

                if (!unifiedId) {
                    // OK, truly orphan.
                    unifiedId = `slug:${slug}`;
                }
            }

            if (!unifiedId) {
                skippedCount++;
                continue;
            }

            // Aggregate
            if (!statsMap.has(unifiedId)) {
                statsMap.set(unifiedId, {
                    id: unifiedId,
                    title: unifiedItem?.title || entry.title,
                    year: unifiedItem?.year,
                    poster: unifiedItem?.posterPath || (entry.thumb ? `/api/proxy/image?serverId=${entry.serverId}&thumb=${encodeURIComponent(entry.thumb)}` : undefined),
                    type: (unifiedItem?.type || (entry.type === 'movie' ? 'movie' : 'episode')) as any,
                    totalPlays: 0,
                    uniqueUsers: 0,
                    totalDuration: 0,
                    firstSeen: new Date(entry.startTime).toISOString(),
                    lastSeen: new Date(entry.stopTime).toISOString(),
                    serverIds: new Set(),
                    userIds: new Set()
                });
            }

            const stat = statsMap.get(unifiedId)!;
            stat.totalPlays++;
            stat.totalDuration += entry.duration;
            stat.serverIds.add(entry.serverId);
            if (entry.user) stat.userIds.add(entry.user);

            // Fix date comparison
            // entry.startTime is number (ms)
            if (entry.startTime < new Date(stat.firstSeen).getTime()) stat.firstSeen = new Date(entry.startTime).toISOString();
            if (entry.stopTime > new Date(stat.lastSeen).getTime()) stat.lastSeen = new Date(entry.stopTime).toISOString();
        }

        // Finalize uniqueUsers count
        for (const stat of statsMap.values()) {
            stat.uniqueUsers = stat.userIds.size;
        }

        console.log(`[Stats] Aggregation Complete. Matched via Lib: ${matchedCount}, Fallback: ${fallbackCount}. Writing ${statsMap.size} entries to DB...`);

        // 4. Batch Write
        if (jobId) updateJob(jobId, { progress: 85, message: 'Saving statistics...' });
        
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO media_statistics (id, title, year, poster, type, totalPlays, uniqueUsers, totalDuration, firstSeen, lastSeen, meta_json)
            VALUES (@id, @title, @year, @poster, @type, @totalPlays, @uniqueUsers, @totalDuration, @firstSeen, @lastSeen, @meta_json)
        `);

        const transaction = db.transaction((stats: MediaStatEntry[]) => {
            // Optional: Clear old stats?
            db.prepare("DELETE FROM media_statistics").run();

            for (const stat of stats) {
                insertStmt.run({
                    id: stat.id,
                    title: stat.title,
                    year: stat.year,
                    poster: stat.poster,
                    type: stat.type,
                    totalPlays: stat.totalPlays,
                    uniqueUsers: stat.uniqueUsers,
                    totalDuration: stat.totalDuration,
                    firstSeen: stat.firstSeen,
                    lastSeen: stat.lastSeen,
                    meta_json: JSON.stringify({ serverIds: Array.from(stat.serverIds) })
                });
            }
        });

        transaction(Array.from(statsMap.values()));

        console.log(`[Stats] Reconciliation Finished in ${(Date.now() - startTime)}ms.`);
        
        if (jobId) updateJob(jobId, { status: 'completed', progress: 100, message: 'Reconciliation complete', itemsProcessed: statsMap.size, totalItems: statsMap.size });
        return { count: statsMap.size, time: Date.now() - startTime };

    } catch (e: any) {
        console.error("[Stats] Reconciliation Failed:", e);
        if (jobId) updateJob(jobId, { status: 'failed', message: `Failed: ${e.message}` });
        throw e;
    }
}
