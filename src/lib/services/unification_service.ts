
import { db } from "../db";
import { randomUUID } from "node:crypto";

/**
 * Main function to unify library items into Master Data (UnifiedItem).
 * Strategy: Direct Database Matching (GUID First).
 * Ensures 100% population by creating a UnifiedItem for every unique logical media item.
 */
export async function unifyLibraryItems(forceFullScan = false) {
    console.log(`[Unification] Starting Direct GUID-Based Unification... (Force: ${forceFullScan})`);

    const startTime = Date.now();
    let created = 0;
    let linked = 0;
    let matched = 0;

    // 1. Load Existing Unified State (To minimize DB hits)
    // Map: GUID -> UnifiedID
    // Map: Slug -> UnifiedID
    const unifiedItems = db.prepare("SELECT id, guid, title, year FROM UnifiedItem").all() as any[];
    const guidMap = new Map<string, string>();
    const slugMap = new Map<string, string>();

    for (const ui of unifiedItems) {
        if (ui.guid) guidMap.set(ui.guid, ui.id);

        // Also map by slug if guid is a slug
        if (ui.guid.startsWith('slug:')) {
            slugMap.set(ui.guid.replace('slug:', ''), ui.id);
        } else {
            // For existing items, we can generate a slug to allow fallback matching?
            // Yes, let's map the title-year slug to this ID too, so if a new file comes in with NO GUIDs but same title, it matches.
            const s = toSlug(ui.title, ui.year);
            // Priority: If slug conflict, first one wins (usually fine).
            if (!slugMap.has(s)) slugMap.set(s, ui.id);
        }
    }
    console.log(`[Unification] Loaded ${unifiedItems.length} existing unified items.`);

    // 2. Fetch Library Items
    // Optimization: Should we only fetch items with specific processing needs?
    // For now, fetch ALL to guarantee complete reconciliation.
    const libraryItems = db.prepare("SELECT * FROM library_items").all() as any[];
    console.log(`[Unification] Processing ${libraryItems.length} library items...`);

    // Prepared Statements
    const insertUnified = db.prepare(`
        INSERT INTO UnifiedItem (id, guid, title, year, poster, type, meta_json, updatedAt)
        VALUES (@id, @guid, @title, @year, @poster, @type, @meta_json, CURRENT_TIMESTAMP)
    `);

    const updateUnifiedMeta = db.prepare(`
        UPDATE UnifiedItem 
        SET meta_json = @meta_json, updatedAt = CURRENT_TIMESTAMP
        WHERE id = @id
    `);

    // const updateUnified = db.prepare(`UPDATE UnifiedItem SET ...`); // Optional: Metadata refresh

    const linkItem = db.prepare(`
        UPDATE library_items 
        SET unifiedItemId = @unifiedItemId 
        WHERE serverId = @serverId AND ratingKey = @ratingKey
    `);

    // Helper: Slug Generator
    function toSlug(title: string, year?: number) {
        return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${year || 'xxxx'}`;
    }

    const transaction = db.transaction(() => {
        for (const item of libraryItems) {

            // Extract Metadata & GUIDs
            let meta: any = {};
            try { meta = JSON.parse(item.meta_json || '{}'); } catch (e) { }

            const rawGuids = Array.isArray(meta.Guid) ? meta.Guid : (meta.Guid ? [meta.Guid] : []);
            const guidsFromMeta: string[] = [];

            // Standardize GUIDs from meta
            rawGuids.forEach((g: any) => {
                if (g.id) guidsFromMeta.push(g.id);
            });
            // Also check main 'guid' field in meta
            if (meta.guid && !guidsFromMeta.includes(meta.guid)) guidsFromMeta.push(meta.guid);


            // Priority: IMDB > TMDB > TVDB > Plex
            const imdb = guidsFromMeta.find(g => g.startsWith('imdb://'));
            const tmdb = guidsFromMeta.find(g => g.startsWith('tmdb://'));
            const tvdb = guidsFromMeta.find(g => g.startsWith('tvdb://'));
            const plex = guidsFromMeta.find(g => g.startsWith('plex://'));

            // Match Logic
            let unifiedId: string | undefined;
            let matchType = '';

            // 1. Try GUID Match (against existing Map)
            if (imdb && guidMap.has(imdb)) { unifiedId = guidMap.get(imdb); matchType = 'imdb'; }
            else if (tmdb && guidMap.has(tmdb)) { unifiedId = guidMap.get(tmdb); matchType = 'tmdb'; }
            else if (tvdb && guidMap.has(tvdb)) { unifiedId = guidMap.get(tvdb); matchType = 'tvdb'; }
            else if (plex && guidMap.has(plex)) { unifiedId = guidMap.get(plex); matchType = 'plex'; }

            // 2. Try Slug Match
            const slug = toSlug(item.title, item.year);
            if (!unifiedId && slugMap.has(slug)) {
                unifiedId = slugMap.get(slug);
                matchType = 'slug-lookup';
            }

            // 3. New Unified Item
            if (!unifiedId) {
                // Determine Primary GUID for this new item
                let primaryGuid = imdb || tmdb || tvdb || plex;

                if (!primaryGuid) {
                    primaryGuid = `slug:${slug}`;
                    matchType = 'new-slug';
                } else {
                    matchType = 'new-guid';
                }

                unifiedId = randomUUID();

                // Prepare Unified Meta
                const unifiedMeta: any = {
                    parentThumb: item.type === 'episode' ? (meta.parentThumb || null) : null,
                    grandparentThumb: item.type === 'episode' ? (meta.grandparentThumb || null) : null,
                    // Store original GUIDs too for reference?
                    guids: guidsFromMeta
                };

                // Create
                insertUnified.run({
                    id: unifiedId,
                    guid: primaryGuid,
                    title: item.title,
                    year: item.year,
                    poster: item.thumb, // Basic thumb for now
                    type: item.type,
                    meta_json: JSON.stringify(unifiedMeta)
                });

                // Update Maps
                if (primaryGuid) guidMap.set(primaryGuid, unifiedId);
                slugMap.set(slug, unifiedId);

                // Map other aliases too? 
                if (imdb) guidMap.set(imdb, unifiedId);
                if (tmdb) guidMap.set(tmdb, unifiedId);

                created++;
            } else {
                // UPDATE Existing Item Meta (Crucial for fixing missing posters on existing items)
                const unifiedMeta: any = {
                    parentThumb: item.type === 'episode' ? (meta.parentThumb || null) : null,
                    grandparentThumb: item.type === 'episode' ? (meta.grandparentThumb || null) : null,
                    guids: guidsFromMeta
                };

                // We blindly update meta for now to ensure coverage. 
                // Optimization: Check if changed?
                updateUnifiedMeta.run({
                    id: unifiedId,
                    meta_json: JSON.stringify(unifiedMeta)
                });

                matched++;
            }

            // 4. Link
            // Only update if different?
            if (item.unifiedItemId !== unifiedId) {
                linkItem.run({
                    unifiedItemId: unifiedId,
                    serverId: item.serverId,
                    ratingKey: item.ratingKey
                });
                linked++;
            }
        }
    });

    transaction();

    // Phase 2: Hierarchy (Episodes)
    // Ensure episodes point to parent shows
    // (Existing logic was fine, we preserve it)
    console.log(`[Unification] Linking hierarchy...`);
    let hierarchyLinks = 0;

    const episodes = db.prepare(`
        SELECT li.ratingKey, li.serverId, li.meta_json, li.unifiedItemId, ui.id as unifiedId, ui.parentId
        FROM library_items li
        JOIN UnifiedItem ui ON li.unifiedItemId = ui.id
        WHERE li.type = 'episode'
    `).all() as any[];

    const updateParent = db.prepare("UPDATE UnifiedItem SET parentId = @parentId WHERE id = @id");

    const hTransaction = db.transaction(() => {
        for (const ep of episodes) {
            if (!ep.meta_json) continue;
            try {
                const meta = JSON.parse(ep.meta_json);
                const grandparentRatingKey = meta.grandparentRatingKey;

                if (grandparentRatingKey) {
                    // Find the UnifiedItem of the SHOW
                    // The show is a library_item with ratingKey = grandparentRatingKey on the SAME server
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
    hTransaction();

    console.log(`[Unification] Complete. Created New: ${created}, Matched: ${matched}, Linked (Updates): ${linked}, Hierarchy Fixed: ${hierarchyLinks}. Time: ${Date.now() - startTime}ms`);
    return { created, matched, linked, hierarchyLinks };
}
