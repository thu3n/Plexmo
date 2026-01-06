import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
console.log(`[DB] Resolved Database Path: ${dbPath}`);


// Interface matching better-sqlite3 parts we use
interface DBInterface {
  pragma: (str: string) => void;
  exec: (str: string) => void;
  prepare: <T = any[], R = any>(sql: string) => StatementInterface<T, R>;
}

interface StatementInterface<T, R> {
  get: (...params: any[]) => R | undefined;
  all: (...params: any[]) => R[];
  run: (...params: any[]) => { changes: number; lastInsertRowid: number | bigint };
}

let dbInstance: any;

try {
  const db = new Database(dbPath);

  // Use DELETE mode on dev/windows to prevent WAL persistence issues during restart
  if (process.env.NODE_ENV === 'production') {
    db.pragma("journal_mode = WAL");
  } else {
    // Force checkpoint to flush any existing WAL data before switching
    try { db.pragma("wal_checkpoint(RESTART)"); } catch (e) { }
    db.pragma("journal_mode = DELETE");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      baseUrl TEXT NOT NULL,
      token TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_history (
      id TEXT PRIMARY KEY,
      serverId TEXT NOT NULL,
      userId TEXT,
      user TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      ratingKey TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      stopTime INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      platform TEXT,
      device TEXT,
      ip TEXT,
      meta_json TEXT,
      pausedCounter INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
      sessionId TEXT PRIMARY KEY,
      serverId TEXT NOT NULL,
      userId TEXT,
      user TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      ratingKey TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      lastSeen INTEGER NOT NULL,
      state TEXT,
      platform TEXT,
      device TEXT,
      meta_json TEXT,
      pausedCounter INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS libraries (
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT,
      agent TEXT,
      count INTEGER DEFAULT 0,
      refreshing INTEGER DEFAULT 0,
      serverId TEXT NOT NULL,
      serverName TEXT,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (key, serverId)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      targetId TEXT,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      message TEXT,
      itemsProcessed INTEGER DEFAULT 0,
      totalItems INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_items (
      ratingKey TEXT NOT NULL,
      libraryKey TEXT NOT NULL,
      serverId TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      thumb TEXT,
      type TEXT,
      addedAt TEXT,
      updatedAt TEXT NOT NULL,
      meta_json TEXT,
      PRIMARY KEY (ratingKey, serverId)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      thumb TEXT,
      serverId TEXT NOT NULL,
      importedAt TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      PRIMARY KEY (id, serverId)
    );


    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS allowed_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      createdAt TEXT NOT NULL,
      removeAfterLogin INTEGER DEFAULT 1,
      expiresAt TEXT
    );

    CREATE TABLE IF NOT EXISTS rules (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      isActive INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_rules (
      userId TEXT NOT NULL,
      ruleKey TEXT NOT NULL,
      PRIMARY KEY (userId, ruleKey)
    );

    CREATE TABLE IF NOT EXISTS server_rules (
      serverId TEXT NOT NULL,
      ruleKey TEXT NOT NULL,
      PRIMARY KEY (serverId, ruleKey)
    );

    CREATE TABLE IF NOT EXISTS rule_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ruleKey TEXT NOT NULL,
      userId TEXT NOT NULL,
      triggeredAt TEXT NOT NULL,
      endedAt TEXT,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS discord_webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_instances (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      settings TEXT NOT NULL,
      discordWebhookId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concurrent_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count INTEGER NOT NULL,
      sessions TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_group_members (
      group_id TEXT NOT NULL,
      library_key TEXT NOT NULL,
      server_id TEXT NOT NULL,
      server_name TEXT,
      PRIMARY KEY (group_id, library_key, server_id),
      FOREIGN KEY (group_id) REFERENCES library_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS external_metadata (
        id TEXT PRIMARY KEY,
        poster_path TEXT,
        backdrop_path TEXT,
        overview TEXT,
        updated_at TEXT
    );

    --// Streak Cache Table
    CREATE TABLE IF NOT EXISTS streak_cache (
      username TEXT PRIMARY KEY,
      userId TEXT,
      currentStreak INTEGER NOT NULL,
      longestStreak INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    -- INDEXES FOR PERFORMANCE
    CREATE INDEX IF NOT EXISTS idx_history_dup_check ON activity_history(user, ratingKey, startTime);
    CREATE INDEX IF NOT EXISTS idx_active_dup_check ON active_sessions(user, ratingKey, startTime);
    CREATE INDEX IF NOT EXISTS idx_history_starttime ON activity_history(startTime);
  `);


  // Checks for migration: add color column if missing
  try {
    db.prepare("ALTER TABLE servers ADD COLUMN color TEXT").run();
  } catch (e: any) {
    // Column likely already exists
  }

  // Migration: allowed_users new columns
  try {
    db.prepare("ALTER TABLE allowed_users ADD COLUMN removeAfterLogin INTEGER DEFAULT 1").run();
  } catch (e: any) { }

  try {
    db.prepare("ALTER TABLE allowed_users ADD COLUMN expiresAt TEXT").run();
  } catch (e: any) { }

  // Migration: Add meta_json to activity_history
  try {
    db.prepare("ALTER TABLE activity_history ADD COLUMN meta_json TEXT").run();
  } catch (e: any) { }

  // Migration: Add meta_json to active_sessions
  try {
    db.prepare("ALTER TABLE active_sessions ADD COLUMN meta_json TEXT").run();
  } catch (e: any) { }

  // Migration: Add pausedCounter to activity_history
  try {
    db.prepare("ALTER TABLE activity_history ADD COLUMN pausedCounter INTEGER DEFAULT 0").run();
  } catch (e: any) { }

  // Migration: Add pausedCounter to active_sessions
  try {
    db.prepare("ALTER TABLE active_sessions ADD COLUMN pausedCounter INTEGER DEFAULT 0").run();
  } catch (e: any) { }

  // Migration: Add pausedSince to active_sessions (For Kill Paused Stream Rule)
  try {
    db.prepare("ALTER TABLE active_sessions ADD COLUMN pausedSince INTEGER").run();
  } catch (e: any) { }

  // Migration: Add isAdmin to users
  try {
    db.prepare("ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0").run();
  } catch (e: any) { }

  // Migration: Add title to users
  try {
    db.prepare("ALTER TABLE users ADD COLUMN title TEXT").run();
    // Default title to username if empty
    db.prepare("UPDATE users SET title = username WHERE title IS NULL").run();
  } catch (e: any) { }

  // Migration: Add endedAt to rule_events
  try {
    db.prepare("ALTER TABLE rule_events ADD COLUMN endedAt TEXT").run();
  } catch (e: any) { }

  // Migration: Add discordWebhookIds to rule_instances and migrate data
  try {
    db.prepare("ALTER TABLE rule_instances ADD COLUMN discordWebhookIds TEXT").run();
    // Migrate existing single ID to array
    const rules = db.prepare("SELECT id, discordWebhookId FROM rule_instances WHERE discordWebhookId IS NOT NULL").all() as any[];
    const updateStmt = db.prepare("UPDATE rule_instances SET discordWebhookIds = ? WHERE id = ?");
    for (const rule of rules) {
      if (rule.discordWebhookId) {
        updateStmt.run(JSON.stringify([rule.discordWebhookId]), rule.id);
      }
    }
    console.log("[Migration] Migrated rule webhooks to multi-select format");
  } catch (e: any) {
    // Column likely exists
  }

  // Migration: Add userId to activity_history
  try {
    db.prepare("ALTER TABLE activity_history ADD COLUMN userId TEXT").run();
  } catch (e: any) { }

  // Migration: Add userId to active_sessions
  try {
    db.prepare("ALTER TABLE active_sessions ADD COLUMN userId TEXT").run();
  } catch (e: any) { }

  // Migration: Backfill userId for activity_history
  try {
    // Check if we have null userIds
    const check = db.prepare("SELECT count(*) as count FROM activity_history WHERE userId IS NULL").get() as any;
    if (check.count > 0) {
      console.log("[Migration] Backfilling userIds for activity_history...");
      // Try match by username first, then title

      // 1. Update where user matches username (exact match)
      db.prepare(`
        UPDATE activity_history 
        SET userId = (SELECT id FROM users WHERE users.username = activity_history.user AND users.serverId = activity_history.serverId LIMIT 1)
        WHERE userId IS NULL
      `).run();

      // 2. Update where user matches title (Display Name)
      db.prepare(`
        UPDATE activity_history 
        SET userId = (SELECT id FROM users WHERE users.title = activity_history.user AND users.serverId = activity_history.serverId LIMIT 1)
        WHERE userId IS NULL
      `).run();

      console.log("[Migration] Backfill complete.");
    }
  } catch (e: any) {
    console.error("[Migration] Failed to backfill userIds:", e);
  }

  // Migration: Create libraries table if it doesn't exist (handled by CREATE TABLE IF NOT EXISTS above, 
  // but if we were adding columns to existing, we'd do it here. 
  // Since it's a new table completely, the CREATE block handles it for new sets.
  // For existing DBs running this code first time, the CREATE block also handles it.
  // So no explicit ALTER needed unless we add columns later.)

  dbInstance = db;

  // Ensure Tautulli import directory exists
  try {
    const importDir = path.join(process.cwd(), "config", "import", "Tautulli");
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
      console.log(`[Init] Created Tautulli import directory: ${importDir}`);
    }
  } catch (e) {
    console.error("[Init] Failed to create Tautulli import directory:", e);
  }
} catch (error) {
  console.error("CRITICAL: FAILED TO INITIALIZE DATABASE.");
  console.error(error);
  console.error("The application will start in recovery mode. Please check file permissions.");

  // Mock DB to prevent crash at startup (e.g. when servers.ts calls prepare())
  dbInstance = {
    pragma: () => { },
    exec: () => { },
    prepare: () => ({
      get: () => { throw new Error("Database not initialized (Check Permissions)"); },
      all: () => { throw new Error("Database not initialized (Check Permissions)"); },
      run: () => { throw new Error("Database not initialized (Check Permissions)"); },
    }),
  };
}

export const db = dbInstance as Database.Database;
