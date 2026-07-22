const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPaths = [
    path.join(process.cwd(), "config/plex-monitor.db"),
    path.join(process.cwd(), "prisma/dev.db")
];

const results = [];

dbPaths.forEach(dbPath => {
    if (!fs.existsSync(dbPath)) return;

    try {
        const db = new Database(dbPath);
        const columns = db.prepare("PRAGMA table_info(activity_history)").all();
        const hasPlexGuid = columns.some(c => c.name === 'plex_guid');

        if (!hasPlexGuid) return;

        const nullCount = db.prepare("SELECT count(*) as c FROM activity_history WHERE plex_guid IS NULL").get().c;
        const emptyCount = db.prepare("SELECT count(*) as c FROM activity_history WHERE plex_guid = ''").get().c;

        const samples = db.prepare(`
            SELECT id, title, ratingKey, serverId, repair_status, plex_guid
            FROM activity_history 
            WHERE plex_guid IS NULL OR plex_guid = ''
            LIMIT 5
        `).all();

        results.push({
            dbPath,
            nullCount,
            emptyCount,
            samples
        });

    } catch (e) {
        results.push({ dbPath, error: e.message });
    }
});

console.log(JSON.stringify(results, null, 2));
