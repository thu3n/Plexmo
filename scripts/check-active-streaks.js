
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const resolveDbPath = () => {
    // ... same resolver ...
    if (process.env.CONFIG_DIR) return path.join(process.env.CONFIG_DIR, "plex-monitor.db");
    const dockerConfigPath = path.join(process.cwd(), "config");
    if (process.env.NODE_ENV === "production" && fs.existsSync(dockerConfigPath)) return path.join(dockerConfigPath, "plex-monitor.db");
    if (fs.existsSync("/app/config")) return path.join("/app/config", "plex-monitor.db");
    const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
    const normalized = raw.startsWith("file:") ? raw.replace(/^file:/, "") : raw;
    return path.isAbsolute(normalized) ? normalized : path.join(process.cwd(), normalized);
};

const dbPath = resolveDbPath();
const db = new Database(dbPath);

const activeStreaks = db.prepare("SELECT * FROM streak_cache WHERE currentStreak > 0 ORDER BY currentStreak DESC").all();
console.log(`Found ${activeStreaks.length} active streaks.`);
if (activeStreaks.length > 0) {
    console.log("Top 5:", activeStreaks.slice(0, 5));
} else {
    console.log("No active streaks found.");
}

const totalCache = db.prepare("SELECT count(*) as count FROM streak_cache").get();
console.log(`Total cache entries: ${totalCache.count}`);
