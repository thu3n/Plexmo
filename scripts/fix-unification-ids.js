const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

function extractId(guids, protocol) {
    const found = guids.find(g => g.startsWith(protocol + '://'));
    if (!found) return null;
    return found.replace(protocol + '://', '');
}

try {
    console.log("Starting Unification ID Backfill...");

    // 1. Fetch Unified Items with their associated Library Items to get the metadata
    // Wait, UnifiedItem has `meta_json` but it might be stale.
    // Better to fetch `library_items` that are linked to UnifiedItems and re-parse.

    // Actually, `unifyLibraryItems` iterates `library_items`.
    // Let's do the same.
    const libraryItems = db.prepare("SELECT * FROM library_items").all();
    console.log(`Processing ${libraryItems.length} library items...`);

    const updateUnifiedId = db.prepare(`
        UPDATE UnifiedItem 
        SET imdb_id = COALESCE(@imdb_id, imdb_id), 
            tmdb_id = COALESCE(@tmdb_id, tmdb_id), 
            tvdb_id = COALESCE(@tvdb_id, tvdb_id),
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = @id
    `);

    let updated = 0;

    const transaction = db.transaction(() => {
        for (const item of libraryItems) {
            if (!item.unifiedItemId) continue;

            let meta = {};
            try { meta = JSON.parse(item.meta_json || '{}'); } catch (e) { }

            const rawGuids = Array.isArray(meta.Guid) ? meta.Guid : (meta.Guid ? [meta.Guid] : []);
            const guidsFromMeta = [];

            rawGuids.forEach((g) => {
                if (g.id) guidsFromMeta.push(g.id);
            });
            if (meta.guid && !guidsFromMeta.includes(meta.guid)) guidsFromMeta.push(meta.guid);

            const imdbId = extractId(guidsFromMeta, 'imdb');
            const tmdbId = extractId(guidsFromMeta, 'tmdb');
            const tvdbId = extractId(guidsFromMeta, 'tvdb');

            if (imdbId || tmdbId || tvdbId) {
                updateUnifiedId.run({
                    id: item.unifiedItemId,
                    imdb_id: imdbId,
                    tmdb_id: tmdbId,
                    tvdb_id: tvdbId
                });
                updated++;
            }
        }
    });

    transaction();
    console.log(`Backfill complete. Updated ${updated} items.`);

} catch (e) {
    console.error("Error:", e);
}
