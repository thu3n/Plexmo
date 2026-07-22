import fs from "node:fs";
import path from "node:path";

/**
 * Single source of truth for the config-volume location — previously
 * duplicated (with subtly different fallbacks) in db.ts, jwt-secret.ts,
 * the export route and the filesystem route. Two shapes on purpose:
 * the DIRECTORY resolver falls back to ./prisma, the DB-PATH resolver
 * additionally honours DATABASE_URL. Node-only (fs) — never import from
 * middleware or client code.
 */

/** Config directory: CONFIG_DIR → ./config (prod Docker convention) → /app/config → ./prisma (dev). */
export const resolveConfigDir = (): string | null => {
    if (process.env.CONFIG_DIR) return process.env.CONFIG_DIR;
    const cwdConfig = path.join(process.cwd(), "config");
    if (process.env.NODE_ENV === "production" && fs.existsSync(cwdConfig)) return cwdConfig;
    if (fs.existsSync("/app/config")) return "/app/config";
    const devDir = path.join(process.cwd(), "prisma");
    if (fs.existsSync(devDir)) return devDir;
    return null;
};

/** SQLite file path: same chain, but the dev fallback honours DATABASE_URL. */
export const resolveDbPath = (): string => {
    // 1. Explicit override
    if (process.env.CONFIG_DIR) {
        const configDir = process.env.CONFIG_DIR;
        fs.mkdirSync(configDir, { recursive: true });
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
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    return absolutePath;
};
