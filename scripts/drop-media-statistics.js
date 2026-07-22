
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
console.log(`Target Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error("Database file not found!");
    process.exit(1);
}

const db = new Database(dbPath);

try {
    db.prepare("DROP TABLE IF EXISTS media_statistics").run();
    console.log(`Successfully dropped media_statistics table.`);
} catch (error) {
    console.error("Failed to drop media_statistics:", error.message);
}
