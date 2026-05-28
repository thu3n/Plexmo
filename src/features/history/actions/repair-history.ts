"use server";

import { db } from "@/lib/db";
import { fetchItemMetadata, type PlexServerConfig } from "@/lib/plex";

type RepairStats = {
    processed: number;
    repaired: number;
    failed: number; // API errors
    notFound: number; // 404s (Deleted content)
    skipped: number; // No server found
};

export async function repairHistoryBatch(limit: number = 50): Promise<RepairStats> {
    // 1. Fetch Candidates
    // Valid candidates must have a serverId and ratingKey, but match 
    // typical "un-enriched" criteria (missing external IDs).
    // CRITICAL: We now check repair_status IS NULL to prevent infinite loops on broken items.
    const rows = db.prepare(`
    SELECT id, serverId, ratingKey, title 
    FROM activity_history 
    WHERE (imdb_id IS NULL AND tmdb_id IS NULL)
    AND serverId IS NOT NULL 
    AND ratingKey IS NOT NULL
    AND ratingKey != ''
    AND repair_status IS NULL
    LIMIT ?
  `).all(limit) as { id: string, serverId: string, ratingKey: string, title: string }[];

    if (rows.length === 0) {
        return { processed: 0, repaired: 0, failed: 0, notFound: 0, skipped: 0 };
    }

    // 2. Fetch Servers (for credentials)
    const servers = db.prepare("SELECT id, name, baseUrl, token FROM servers").all() as (PlexServerConfig & { id: string })[];
    const serverMap = new Map<string, PlexServerConfig>();
    servers.forEach(s => serverMap.set(s.id, s));

    let processed = 0;
    let repaired = 0;
    let failed = 0;
    let notFound = 0;
    let skipped = 0;

    console.log(`[HistoryRepair] Processing batch of ${rows.length} items...`);

    // Statement for successful repair
    const successStmt = db.prepare(`
    UPDATE activity_history 
    SET imdb_id = @imdb_id, tmdb_id = @tmdb_id, tvdb_id = @tvdb_id, plex_guid = @plex_guid, repair_status = 'repaired'
    WHERE id = @id
  `);

    // Statement for various failure states
    const statusStmt = db.prepare(`
    UPDATE activity_history 
    SET repair_status = @status
    WHERE id = @id
  `);

    for (const row of rows) {
        processed++;

        // Check if server exists
        const server = serverMap.get(row.serverId);
        if (!server) {
            skipped++;
            // We can't do anything without a server. 
            // Mark as 'skipped_no_server' so we don't loop forever?
            // Or just leave it NULL if we hope the server comes back?
            // User requested "No row should remain with repair_status IS NULL after being processed".
            // So we MUST update it.
            statusStmt.run({ status: 'skipped_no_server', id: row.id });
            continue;
        }

        try {
            // 3. Fetch Metadata from Plex
            const metadata = await fetchItemMetadata(row.ratingKey, server);

            if (!metadata) {
                // 404 or Missing
                notFound++;
                statusStmt.run({ status: 'failed_404', id: row.id });
                continue;
            }

            // 4. Parse GUIDs
            let imdb_id: string | null = null;
            let tmdb_id: string | null = null;
            let tvdb_id: string | null = null;
            let plex_guid: string | null = null;

            const guids = Array.isArray(metadata.Guid) ? metadata.Guid : (metadata.Guid ? [metadata.Guid] : []);

            if (metadata.guid) {
                if (metadata.guid.startsWith('plex://')) plex_guid = metadata.guid;
            }

            for (const g of guids) {
                if (!g.id) continue;
                if (g.id.startsWith('imdb://')) imdb_id = g.id.replace('imdb://', '');
                else if (g.id.startsWith('tmdb://')) tmdb_id = g.id.replace('tmdb://', '');
                else if (g.id.startsWith('tvdb://')) tvdb_id = g.id.replace('tvdb://', '');
                else if (g.id.startsWith('plex://')) plex_guid = g.id;
            }

            // If we found ANY useful ID, update
            if (imdb_id || tmdb_id || tvdb_id || plex_guid) {
                successStmt.run({
                    imdb_id,
                    tmdb_id,
                    tvdb_id,
                    plex_guid: plex_guid || null,
                    id: row.id
                });
                repaired++;
            } else {
                // API worked, but no IDs found
                failed++; // Counting as failed since we couldn't repair it
                statusStmt.run({ status: 'failed_no_ids', id: row.id });
            }

        } catch (error) {
            console.error(`[HistoryRepair] Error processing ${row.id}:`, error);
            failed++;
            statusStmt.run({ status: 'error_generic', id: row.id });
        }
    }

    return { processed, repaired, failed, notFound, skipped };
}
