import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Logger } from "./logger";
import { runMigrations } from "./migrations";

const resolveDbPath = () => {
  // 1. Explicit override
  if (process.env.CONFIG_DIR) {
    const configDir = process.env.CONFIG_DIR;
    fs.mkdirSync(configDir, { recursive: true });
    return path.join(configDir, "plex-monitor.db");
  }

  // 2. Docker Volume Convention (/app/config)
  // If this directory exists (mounted via Docker volume), we use it automatically.
  const dockerConfigPath = path.join(process.cwd(), "config");
  if (process.env.NODE_ENV === "production" && fs.existsSync(dockerConfigPath)) {
    return path.join(dockerConfigPath, "plex-monitor.db");
  }

  // Also check absolute path /app/config just in case cwd varies
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

const dbPath = resolveDbPath();
Logger.info(`[DB] Resolved Database Path: ${dbPath}`);


// Interface matching better-sqlite3 parts we use
interface DBInterface {
  pragma: (str: string) => void;
  exec: (str: string) => void;
  prepare: <T = unknown[], R = unknown>(sql: string) => StatementInterface<T, R>;
  transaction?: <F extends (...args: any[]) => any>(fn: F) => F; // Optional for mock
}

interface StatementInterface<T, R> {
  get: (...params: unknown[]) => R | undefined;
  all: (...params: unknown[]) => R[];
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
}

let dbInstance: Database.Database | DBInterface;

try {
  const db = new Database(dbPath);

  // Use DELETE mode on dev/windows to prevent WAL persistence issues during restart
  if (process.env.NODE_ENV === 'production') {
    db.pragma("journal_mode = WAL");
  } else {
    // Force checkpoint to flush any existing WAL data before switching
    try { db.pragma("wal_checkpoint(RESTART)"); } catch (e) { /* ignore */ }
    db.pragma("journal_mode = DELETE");
  }

  // Schema creation and all migrations are versioned and applied here.
  // See src/lib/migrations.ts to add new schema changes.
  runMigrations(db);

  dbInstance = db;

  // Ensure Tautulli import directory exists
  try {
    const importDir = path.join(process.cwd(), "config", "import", "Tautulli");
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
      Logger.info(`[Init] Created Tautulli import directory: ${importDir}`);
    }
  } catch (e) {
    Logger.error("[Init] Failed to create Tautulli import directory:", e);
  }
} catch (error) {
  Logger.error("CRITICAL: FAILED TO INITIALIZE DATABASE.");
  Logger.error("Database Init Error:", error);

  Logger.error("The application will start in recovery mode. Please check file permissions.");

  // Mock DB to prevent crash at startup (e.g. when servers.ts calls prepare())
  const mockDB: DBInterface = {
    pragma: () => { },
    exec: () => { },
    prepare: (<T = unknown[], R = unknown>(sql: string): StatementInterface<T, R> => ({
      get: () => { throw new Error("Database not initialized (Check Permissions)"); },
      all: () => { throw new Error("Database not initialized (Check Permissions)"); },
      run: () => { throw new Error("Database not initialized (Check Permissions)"); },
    })),
    transaction: <F extends (...args: any[]) => any>(fn: F) => (() => { throw new Error("Database not initialized (Check Permissions)"); }) as unknown as F,
  };

  dbInstance = mockDB;
}

export const db = dbInstance as Database.Database;
