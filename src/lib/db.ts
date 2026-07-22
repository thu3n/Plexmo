import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Logger } from "./logger";
import { runMigrations } from "./migrations";
import { resolveConfigDir, resolveDbPath } from "./config-dir";
import { applyPendingRestore } from "./backup/restore-swap";
import {
  pruneBackups,
  PRE_MIGRATION_BACKUP_PATTERN,
  PRE_RESTORE_BACKUP_PATTERN,
  BACKUPS_TO_KEEP,
} from "./backup/backup-retention";

const dbPath = resolveDbPath();
Logger.info(`[DB] Resolved Database Path: ${dbPath}`);

// Boot-time restore swap: MUST run before the SQLite file is opened and
// before any module binds prepared statements. A staged restore (uploaded
// and validated last run) replaces the DB here; the previous file is kept
// aside as pre-restore-backup-<ts>.db.
try {
  if (applyPendingRestore(resolveConfigDir(), dbPath)) {
    Logger.info("[DB] Applied pending restore — database swapped from staged backup.");
  }
} catch (e) {
  Logger.error("[DB] Failed to apply pending restore:", e);
}

// Retention for the accumulating backup copies (pre-migration VACUUMs + pre-restore).
try {
  const backupDir = path.dirname(dbPath);
  const pruned = [
    ...pruneBackups(backupDir, PRE_MIGRATION_BACKUP_PATTERN, BACKUPS_TO_KEEP),
    ...pruneBackups(backupDir, PRE_RESTORE_BACKUP_PATTERN, BACKUPS_TO_KEEP),
  ];
  if (pruned.length > 0) {
    Logger.info(`[DB] Pruned ${pruned.length} old backup file(s): ${pruned.join(", ")}`);
  }
} catch (e) {
  Logger.error("[DB] Backup pruning failed:", e);
}


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

  // One-shot post-migration diagnostic. Single log line covering the things
  // we'd otherwise reach for `pg_stat_user_tables` to get: file size, the
  // hot table's row count, and the largest append-only table's size.
  try {
    const pageCount = (db.pragma("page_count", { simple: true }) as number) ?? 0;
    const pageSize = (db.pragma("page_size", { simple: true }) as number) ?? 0;
    const fileBytes = pageCount * pageSize;
    const fileMb = (fileBytes / (1024 * 1024)).toFixed(1);
    const historyRows = (db.prepare("SELECT COUNT(*) as c FROM activity_history").get() as { c: number }).c;
    const snapshotRows = (db.prepare("SELECT COUNT(*) as c FROM concurrent_snapshots").get() as { c: number }).c;
    Logger.info(
      `[DB] Stats: ${fileMb} MB on disk, ${historyRows} history rows, ${snapshotRows} concurrent_snapshot rows.`
    );
  } catch (e) {
    Logger.error("[DB] Failed to read startup stats:", e);
  }

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
