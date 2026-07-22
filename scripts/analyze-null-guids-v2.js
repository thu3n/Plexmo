const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPaths = [
    path.join(process.cwd(), "config/plex-monitor.db"),
    path.join(process.cwd(), "prisma/dev.db")
];

dbPaths.forEach(dbPath => {
    if (!fs.existsSync(dbPath)) {
        console.log(`Skipping missing DB: ${dbPath}`);
        return;
    }

    console.log(`\n\n=== Analyzing DB: ${dbPath} ===`);
    const db = new Database(dbPath);

    try {
        // Check schema to confirm column name
        const columns = db.prepare("PRAGMA table_info(activity_history)").all();
        const hasPlexGuid = columns.some(c => c.name === 'plex_guid');

        if (!hasPlexGuid) {
            console.log("Column 'plex_guid' does NOT exist in this DB.");
            return;
        }

        // 1. Count Total Nulls
        const totalNull = db.prepare("SELECT count(*) as c FROM activity_history WHERE plex_guid IS NULL").get().c;
        console.log(`Total rows with plex_guid IS NULL: ${totalNull}`);

        // 2. Count Empty Strings
        const totalEmpty = db.prepare("SELECT count(*) as c FROM activity_history WHERE plex_guid = ''").get().c;
        console.log(`Total rows with plex_guid = '': ${totalEmpty}`);

        // 3. Breakdown by Repair Status for NULL or Empty
        const breakdown = db.prepare(`
            SELECT repair_status, count(*) as count 
            FROM activity_history 
            WHERE plex_guid IS NULL OR plex_guid = ''
            GROUP BY repair_status
        `).all();

        if (breakdown.length > 0) {
            console.log("\nBreakdown (Null or Empty):");
            console.table(breakdown);

            // 4. Sample Rows
            console.log("\nSample Rows (Null or Empty):");
            const samples = db.prepare(`
                SELECT id, title, ratingKey, serverId, repair_status, plex_guid
                FROM activity_history 
                WHERE plex_guid IS NULL OR plex_guid = ''
                LIMIT 5
            `).all();
            console.table(samples);
        } else {
            console.log("No abnormal plex_guid rows found.");
        }

    } catch (e) {
        console.error(`Error analyzing ${dbPath}:`, e.message);
    }
});
