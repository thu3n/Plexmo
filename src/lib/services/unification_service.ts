
import { db } from "../db";
import { buildUnifiedItemMap } from "../library_groups";
import { randomUUID } from "node:crypto";

/**
 * Main function to unify library items into Master Data (UnifiedItem).
 * @param forceFullScan If true, checks all items. If false, prioritizes items missing unifiedItemId.
 */
export async function unifyLibraryItems(forceFullScan = false) {
    console.log(`[Unification] Starting... (Force: ${forceFullScan})`);

    // 1. Fetch Items
    let query = "SELECT * FROM library_items";
    // NOTE: Even if we only want "new" items, we need the context of existing items to group them correctly.
    // e.g. New Item A might match Existing Item B.
    // So `buildUnifiedItemMap` needs mostly everything.
    // However, for performance, buildUnifiedItemMap mainly relies on GUIDs.

    // For now, we fetch ALL logic to ensure consistency, as merging "new only" against "existing" 
    // without loading existing might miss matches.
    // Optimization: We could fetch all, but only perform DB UPSERTS if changes are detected.

    const allItems = db.prepare(query).all() as any[];
    console.log(`[Unification] Loaded ${allItems.length} items to process.`);

    // 2. Build Unified Map
    const unifiedMap = buildUnifiedItemMap(allItems);
    const uniqueMergedItems = new Set(unifiedMap.values());
    console.log(`[Unification] Identified ${uniqueMergedItems.size} unique groups.`);

    let created = 0;
    let updated = 0;
    let linked = 0;

    // Prepare Statements
    const upsertUnified = db.prepare(`
        INSERT INTO UnifiedItem (id, guid, title, year, poster, type, updatedAt)
        VALUES (@id, @guid, @title, @year, @poster, @type, CURRENT_TIMESTAMP)
        ON CONFLICT(guid) DO UPDATE SET
            title=excluded.title,
            year=excluded.year,
            poster=excluded.poster,
            type=excluded.type,
            updatedAt=CURRENT_TIMESTAMP
        RETURNING id
    `);

    const linkItem = db.prepare(`
        UPDATE library_items 
        SET unifiedItemId = @unifiedItemId 
        WHERE serverId = @serverId AND ratingKey = @ratingKey
    `);

    const getExistingId = db.prepare("SELECT id FROM UnifiedItem WHERE guid = ?");

    const transaction = db.transaction(() => {
        // Phase 1: Upsert Masters & Link Children
        for (const merged of uniqueMergedItems) {
            const unifiedId = merged.id;
            let masterId: string;

            // Check existence
            const existing = getExistingId.get(unifiedId) as { id: string } | undefined;
            if (existing) {
                masterId = existing.id;
                // Optional: Only update if metadata changed? For now, we let sqlite UPSERT handle it or simple update.
                // We run the UPSERT helper to ensure latest metadata.
                upsertUnified.run({
                    id: masterId,
                    guid: unifiedId,
                    title: merged.title,
                    year: merged.year,
                    poster: merged.posterPath,
                    type: merged.type
                });
                updated++;
            } else {
                masterId = randomUUID();
                upsertUnified.run({
                    id: masterId,
                    guid: unifiedId,
                    title: merged.title,
                    year: merged.year,
                    poster: merged.posterPath,
                    type: merged.type
                });
                created++;
            }

            // Link Sources
            for (const source of merged.sources) {
                // Optimization: Check if already linked? 
                // DB Update is cheap enough for batch.
                linkItem.run({
                    unifiedItemId: masterId,
                    serverId: source.serverId,
                    ratingKey: source.ratingKey
                });
                linked++;
            }
        }
    });
    transaction();

    // Phase 2: Hierarchy (Link Episodes to Shows)
    // We can do this in the same function.
    // Logic: Find episodes with missing parentId or just re-check all.
    const updateParent = db.prepare("UPDATE UnifiedItem SET parentId = @parentId WHERE id = @id");

    // Fetch episodes that have a unifiedItemId
    const episodes = db.prepare(`
        SELECT li.ratingKey, li.serverId, li.meta_json, li.unifiedItemId, ui.id as unifiedId, ui.parentId
        FROM library_items li
        JOIN UnifiedItem ui ON li.unifiedItemId = ui.id
        WHERE li.type = 'episode'
    `).all() as any[];

    let hierarchyLinks = 0;
    const hierTransaction = db.transaction(() => {
        for (const ep of episodes) {
            // Optimization: If parentId already set, skip? 
            // Maybe we want to correct it if it changed.
            // if (ep.parentId) continue; 

            if (!ep.meta_json) continue;
            try {
                const meta = JSON.parse(ep.meta_json);
                const grandparentRatingKey = meta.grandparentRatingKey;

                if (grandparentRatingKey) {
                    // Find parent show item
                    const parentShowItem = db.prepare(`
                        SELECT unifiedItemId 
                        FROM library_items 
                        WHERE serverId = ? AND ratingKey = ?
                    `).get(ep.serverId, grandparentRatingKey) as { unifiedItemId: string } | undefined;

                    if (parentShowItem && parentShowItem.unifiedItemId) {
                        if (ep.parentId !== parentShowItem.unifiedItemId) {
                            updateParent.run({
                                parentId: parentShowItem.unifiedItemId,
                                id: ep.unifiedId
                            });
                            hierarchyLinks++;
                        }
                    }
                }
            } catch (e) { }
        }
    });
    hierTransaction();

    console.log(`[Unification] Complete. Created: ${created}, Updated: ${updated}, Linked Items: ${linked}, Hierarchy Links: ${hierarchyLinks}`);

    return { created, updated, linked, hierarchyLinks };
}
