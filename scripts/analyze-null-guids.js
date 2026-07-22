const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const resolveDbPath = () => {
    // Basic resolution logic for script
    const dockerConfigPath = path.join(process.cwd(), "config");
    if (fs.existsSync(path.join(dockerConfigPath, "plex-monitor.db"))) {
        return path.join(dockerConfigPath, "plex-monitor.db");
    }
    return "prisma/dev.db";
};

const dbPath = resolveDbPath();
console.log(`Using DB: ${dbPath}`);
const db = new Database(dbPath);

try {
    // 1. Count Total Nulls
    const totalNull = db.prepare("SELECT count(*) as c FROM activity_history WHERE plex_guid IS NULL").get().c;
    console.log(`\nTotal rows with plex_guid IS NULL: ${totalNull}`);

    if (totalNull === 0) return;

    // 2. Breakdown by Repair Status
    console.log("\n--- Breakdown by repair_status ---");
    const statusBreakdown = db.prepare(`
        SELECT repair_status, count(*) as count 
        FROM activity_history 
        WHERE plex_guid IS NULL 
        GROUP BY repair_status
    `).all();
    console.table(statusBreakdown);

    // 3. Sample Rows (Top 10)
    console.log("\n--- Sample Rows (Top 10) ---");
    const samples = db.prepare(`
        SELECT id, title, ratingKey, serverId, repair_status 
        FROM activity_history 
        WHERE plex_guid IS NULL 
        LIMIT 10
    `).all();
    console.table(samples);

} catch (e) {
    console.error(e);
}
