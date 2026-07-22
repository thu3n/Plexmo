const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Logic to resolve DB path matching src/lib/db.ts
const resolveDbPath = () => {
    if (process.env.CONFIG_DIR) {
        return path.join(process.env.CONFIG_DIR, "plex-monitor.db");
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
console.log(`Checking database at: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error("Database file not found!");
    process.exit(1);
}

const db = new Database(dbPath);

try {
    const columns = db.pragma('table_info(activity_history)');
    const repairStatusColumn = columns.find(col => col.name === 'repair_status');

    if (repairStatusColumn) {
        console.log("SUCCESS: 'repair_status' column found in 'activity_history'.");
        console.log(repairStatusColumn);
    } else {
        console.error("FAILURE: 'repair_status' column NOT found in 'activity_history'.");
        console.log("Existing columns:", columns.map(c => c.name).join(", "));
        process.exit(1);
    }
} catch (error) {
    console.error("Error inspecting database:", error);
    process.exit(1);
}
