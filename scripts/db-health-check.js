
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const resolveDbPath = () => {
    if (process.env.CONFIG_DIR) {
        const configDir = process.env.CONFIG_DIR;
        return path.join(configDir, "plex-monitor.db");
    }
    const dockerConfigPath = path.join(process.cwd(), "config");
    if (process.env.NODE_ENV === "production" && fs.existsSync(dockerConfigPath)) {
        return path.join(dockerConfigPath, "plex-monitor.db");
    }
    if (fs.existsSync("/app/config")) {
        return path.join("/app/config", "plex-monitor.db");
    }
    const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
    const normalized = raw.startsWith("file:") ? raw.replace(/^file:/, "") : raw;
    return path.isAbsolute(normalized) ? normalized : path.join(process.cwd(), normalized);
};

const dbPath = resolveDbPath();
console.log(`Analyzing Database at: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error("Database file not found!");
    process.exit(1);
}

const db = new Database(dbPath);

function checkIndexes(tableName) {
    console.log(`\n--- Indexes for ${tableName} ---`);
    const indexes = db.prepare(`PRAGMA index_list('${tableName}')`).all();
    const result = [];
    for (const idx of indexes) {
        const info = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
        const columns = info.map(i => i.name).join(', ');
        console.log(`- ${idx.name}: (${columns}) [Unique: ${idx.unique}]`);
        result.push({ name: idx.name, columns });
    }
    return result;
}

function analyzeColumnSize(tableName, colName) {
    try {
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as count,
                AVG(LENGTH(${colName})) as avg_size,
                MAX(LENGTH(${colName})) as max_size,
                SUM(LENGTH(${colName})) as total_size
            FROM ${tableName}
            WHERE ${colName} IS NOT NULL
        `).get();
        console.log(`Column '${colName}' in '${tableName}': Avg=${Math.round(stats.avg_size || 0)} bytes, Max=${stats.max_size || 0} bytes, Total=${(stats.total_size / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
        console.log(`Could not analyze ${colName} in ${tableName}: ${e.message}`);
    }
}

// 1. Check Indexes
const historyIndexes = checkIndexes('activity_history');
const unifiedIndexes = checkIndexes('UnifiedItem');

// 2. Check for critical specific indexes
const hasImdbHistory = historyIndexes.some(i => i.columns.includes('imdb_id'));
const hasTmdbHistory = historyIndexes.some(i => i.columns.includes('tmdb_id')); // Note: code had duplicate add column but likely one index
const hasRepairStatus = historyIndexes.some(i => i.columns.includes('repair_status'));

console.log(`\n--- Critical Index Check ---`);
console.log(`activity_history.imdb_id index present? ${hasImdbHistory ? 'YES' : 'NO'}`);
console.log(`activity_history.tmdb_id index present? ${hasTmdbHistory ? 'YES' : 'NO'}`);
console.log(`activity_history.repair_status index present? ${hasRepairStatus ? 'YES' : 'NO'}`);

// 3. Analyze Storage
console.log(`\n--- Storage Analysis (Large Columns) ---`);
analyzeColumnSize('activity_history', 'meta_json');
analyzeColumnSize('UnifiedItem', 'meta_json');
analyzeColumnSize('active_sessions', 'meta_json');
// analyzeColumnSize('media_items', 'payload'); // assuming media_items might be library_items? User said "media_items" but schema says "library_items", checking library_items just in case
analyzeColumnSize('library_items', 'meta_json');

