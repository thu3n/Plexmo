
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const resolveDbPath = () => {
    // 1. Explicit override
    if (process.env.CONFIG_DIR) {
        const configDir = process.env.CONFIG_DIR;
        try { fs.mkdirSync(configDir, { recursive: true }); } catch (e) { console.log('Err mkdir CONFIG_DIR'); }
        return path.join(configDir, "plex-monitor.db");
    }

    // 2. Docker Volume Convention (/app/config)
    const dockerConfigPath = path.join(process.cwd(), "config");
    if (process.env.NODE_ENV === "production" && fs.existsSync(dockerConfigPath)) {
        return path.join(dockerConfigPath, "plex-monitor.db");
    }

    if (fs.existsSync("/app/config")) {
        return path.join("/app/config", "plex-monitor.db");
    }

    // 3. Local Development Fallback
    const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
    const normalized = raw.startsWith("file:") ? raw.replace(/^file:/, "") : raw;
    const absolutePath = path.isAbsolute(normalized)
        ? normalized
        : path.join(process.cwd(), normalized);

    try {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    } catch (e) {
        console.error("Failed to mkdir:", e);
    }
    return absolutePath;
};

const dbPath = resolveDbPath();
console.log(`Resolved Path: ${dbPath}`);

try {
    const db = new Database(dbPath);
    console.log("Database opened successfully");
    const changes = db.pragma("journal_mode = DELETE");
    console.log("Pragma set:", changes);
    db.close();
} catch (e) {
    console.error("FAILED TO OPEN DB:");
    console.error(e);
}
