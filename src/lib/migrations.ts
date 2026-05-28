import type Database from "better-sqlite3";
import { Logger } from "./logger";

/**
 * Versioned migration system.
 *
 * Each migration has a unique, monotonically increasing `version`. The
 * `schema_migrations` table records which versions have been applied, so every
 * migration runs exactly once per database and in order.
 *
 * ## Adding a migration
 *
 * Append a new entry to the `migrations` array with the next version number.
 * Because the version gate guarantees a migration runs only once, the SQL can
 * be plain and non-defensive — no `CREATE TABLE IF NOT EXISTS` and no
 * `try/catch ALTER`. Write the change as if the previous version is the known
 * starting state.
 */

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "baseline_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          baseUrl TEXT NOT NULL,
          token TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          color TEXT
        );

        CREATE TABLE activity_history (
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
          player TEXT,
          ip TEXT,
          meta_json TEXT,
          pausedCounter INTEGER DEFAULT 0,
          plex_guid TEXT,
          imdb_id TEXT,
          tmdb_id TEXT,
          tvdb_id TEXT,
          repair_status TEXT
        );

        CREATE TABLE active_sessions (
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
          pausedCounter INTEGER DEFAULT 0,
          pausedSince INTEGER
        );

        CREATE TABLE libraries (
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

        CREATE TABLE jobs (
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

        CREATE TABLE library_items (
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

        CREATE TABLE users (
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

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE allowed_users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT,
          createdAt TEXT NOT NULL,
          removeAfterLogin INTEGER DEFAULT 1,
          expiresAt TEXT
        );

        CREATE TABLE rules (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          isActive INTEGER DEFAULT 0
        );

        CREATE TABLE user_rules (
          userId TEXT NOT NULL,
          ruleKey TEXT NOT NULL,
          PRIMARY KEY (userId, ruleKey)
        );

        CREATE TABLE server_rules (
          serverId TEXT NOT NULL,
          ruleKey TEXT NOT NULL,
          PRIMARY KEY (serverId, ruleKey)
        );

        CREATE TABLE rule_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ruleKey TEXT NOT NULL,
          userId TEXT NOT NULL,
          triggeredAt TEXT NOT NULL,
          endedAt TEXT,
          details TEXT
        );

        CREATE TABLE discord_webhooks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE rule_instances (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          settings TEXT NOT NULL,
          discordWebhookIds TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE concurrent_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          count INTEGER NOT NULL,
          sessions TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE external_metadata (
          id TEXT PRIMARY KEY,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          updated_at TEXT
        );

        CREATE TABLE streak_cache (
          username TEXT PRIMARY KEY,
          userId TEXT,
          currentStreak INTEGER NOT NULL,
          longestStreak INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE TABLE user_activity_summary (
          userId TEXT PRIMARY KEY,
          username TEXT,
          total_count INTEGER NOT NULL DEFAULT 0,
          total_duration INTEGER NOT NULL DEFAULT 0,
          last_played_at INTEGER,
          updated_at INTEGER NOT NULL
        );

        -- Duplicate-check indexes for the sync hot path.
        CREATE INDEX idx_history_dup_check ON activity_history(user, ratingKey, startTime);
        CREATE INDEX idx_active_dup_check ON active_sessions(user, ratingKey, startTime);

        -- Recently-played + period-stat queries.
        CREATE INDEX idx_history_starttime ON activity_history(startTime);
        CREATE INDEX idx_history_userid_stoptime ON activity_history(userId, stopTime DESC);
        CREATE INDEX idx_history_user_stoptime ON activity_history(user, stopTime DESC);

        -- External-ID lookups (rewrap/repair flows).
        CREATE INDEX idx_history_plex_guid ON activity_history(plex_guid);
        CREATE INDEX idx_history_imdb ON activity_history(imdb_id);
        CREATE INDEX idx_history_tmdb ON activity_history(tmdb_id);

        -- Retention sweep targets.
        CREATE INDEX idx_concurrent_snapshots_timestamp ON concurrent_snapshots(timestamp);
        CREATE INDEX idx_rule_events_triggered_at ON rule_events(triggeredAt);
        CREATE INDEX idx_jobs_status_updated ON jobs(status, updatedAt);
      `);
    },
  },
];

/**
 * Apply every migration whose version is greater than the highest already
 * recorded in `schema_migrations`. Each migration runs inside its own
 * transaction, so a failure rolls back that migration and leaves the recorded
 * version untouched. Safe to call on every startup — fully applied databases
 * do no work.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const row = db
    .prepare("SELECT MAX(version) as version FROM schema_migrations")
    .get() as { version: number | null };
  const currentVersion = row.version ?? 0;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    Logger.info(`[Migration] Schema up to date (version ${currentVersion}).`);
    return;
  }

  const record = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
  );

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      record.run(migration.version, migration.name, new Date().toISOString());
    });
    try {
      apply();
      Logger.info(`[Migration] Applied v${migration.version} (${migration.name}).`);
    } catch (e) {
      Logger.error(`[Migration] FAILED at v${migration.version} (${migration.name}). Rolled back.`, e);
      throw e;
    }
  }

  Logger.info(`[Migration] Migrated to version ${pending[pending.length - 1].version}.`);
}
