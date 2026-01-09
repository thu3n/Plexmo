
import { db } from "./db";

async function verifyMasterData() {
    console.log("--- Verifying Master Data (Unified Items) ---");

    // 1. Search for Pluribus / Plur1bus
    const query = `
        SELECT ratingKey, serverId, title, unifiedItemId, type
        FROM library_items 
        WHERE title LIKE '%Pluribus%' OR title LIKE '%Plur1bus%'
    `;
    const items = db.prepare(query).all() as any[];

    if (items.length === 0) {
        console.log("No items found matching 'Pluribus' or 'Plur1bus'.");
        return;
    }

    console.log(`Found ${items.length} Library Items.`);

    for (const item of items) {
        console.log(`\n[Library Item] Title: "${item.title}" | Server: ${item.serverId} | Type: ${item.type}`);

        if (!item.unifiedItemId) {
            console.error(`ERROR: unifiedItemId is NULL! Unification failed for this item.`);
            continue;
        }

        console.log(`   -> Unified ID: ${item.unifiedItemId}`);

        // Fetch Unified Item
        const unified = db.prepare("SELECT * FROM UnifiedItem WHERE id = ?").get(item.unifiedItemId) as any;

        if (!unified) {
            console.error(`   ERROR: UnifiedItem record not found for ID ${item.unifiedItemId}`);
            continue;
        }

        console.log(`   -> [Master Record] Title: "${unified.title}" | GUID: ${unified.guid} | Type: ${unified.type}`);

        // Check Hierarchy if Episode
        if (item.type === 'episode' || unified.type === 'episode') {
            if (unified.parentId) {
                const parent = db.prepare("SELECT * FROM UnifiedItem WHERE id = ?").get(unified.parentId) as any;
                if (parent) {
                    console.log(`      -> [Parent/Show] Title: "${parent.title}" | GUID: ${parent.guid}`);
                } else {
                    console.error(`      ERROR: Parent UnifiedItem not found for ID ${unified.parentId}`);
                }
            } else {
                console.warn(`      WARNING: Episode has no parentId set.`);
            }
        }
    }
}

if (require.main === module) {
    verifyMasterData().catch(console.error);
}
