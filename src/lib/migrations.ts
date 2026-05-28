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
 *
 * ## The v1 baseline
 *
 * Version 1 reproduces the historical "create everything, then ALTER in
 * missing columns" behaviour and is intentionally idempotent (IF NOT EXISTS +
 * guarded ALTERs). This lets it stamp pre-existing databases — which already
 * have the full schema but no `schema_migrations` table — at v1 without
 * touching their data, while still building a fresh database from nothing.
 * Do not edit v1 to add new columns; add a new migration instead.
 */

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/** Run an ALTER TABLE that is expected to fail if the column already exists. */
function addColumnIfMissing(db: Database.Database, sql: string) {
  try {
    db.prepare(sql).run();
  } catch {
    // Column already exists — expected on databases created before this column.
  }
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "baseline_schema",
    up: (db) => {
      // --- Tables & indexes (idempotent: matches pre-existing databases) ---
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
          pausedCounter INTEGER DEFAULT 0,
          plex_guid TEXT,
          imdb_id TEXT,
          tmdb_id TEXT,
          tvdb_id TEXT,
          repair_status TEXT
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

        CREATE TABLE IF NOT EXISTS external_metadata (
          id TEXT PRIMARY KEY,
          poster_path TEXT,
          backdrop_path TEXT,
          overview TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS streak_cache (
          username TEXT PRIMARY KEY,
          userId TEXT,
          currentStreak INTEGER NOT NULL,
          longestStreak INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_history_dup_check ON activity_history(user, ratingKey, startTime);
        CREATE INDEX IF NOT EXISTS idx_active_dup_check ON active_sessions(user, ratingKey, startTime);
        CREATE INDEX IF NOT EXISTS idx_history_starttime ON activity_history(startTime);
      `);

      // --- Column additions for databases predating the column above ---
      // (No-ops on fresh databases, where the CREATE TABLE already includes them.)
      addColumnIfMissing(db, "ALTER TABLE servers ADD COLUMN color TEXT");
      addColumnIfMissing(db, "ALTER TABLE allowed_users ADD COLUMN removeAfterLogin INTEGER DEFAULT 1");
      addColumnIfMissing(db, "ALTER TABLE allowed_users ADD COLUMN expiresAt TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN meta_json TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN plex_guid TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN imdb_id TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN tmdb_id TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN tvdb_id TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN repair_status TEXT");
      addColumnIfMissing(db, "ALTER TABLE active_sessions ADD COLUMN meta_json TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN pausedCounter INTEGER DEFAULT 0");
      addColumnIfMissing(db, "ALTER TABLE active_sessions ADD COLUMN pausedCounter INTEGER DEFAULT 0");
      addColumnIfMissing(db, "ALTER TABLE active_sessions ADD COLUMN pausedSince INTEGER");
      addColumnIfMissing(db, "ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0");
      addColumnIfMissing(db, "ALTER TABLE rule_events ADD COLUMN endedAt TEXT");
      addColumnIfMissing(db, "ALTER TABLE rule_instances ADD COLUMN discordWebhookIds TEXT");
      addColumnIfMissing(db, "ALTER TABLE activity_history ADD COLUMN userId TEXT");
      addColumnIfMissing(db, "ALTER TABLE active_sessions ADD COLUMN userId TEXT");

      // Indexes that depend on columns added by addColumnIfMissing above.
      // On a fresh database the columns are present from CREATE TABLE; on a
      // pre-existing main-era database they only exist after the ALTERs.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_history_plex_guid ON activity_history(plex_guid);
        CREATE INDEX IF NOT EXISTS idx_history_imdb ON activity_history(imdb_id);
        CREATE INDEX IF NOT EXISTS idx_history_tmdb ON activity_history(tmdb_id);
      `);

      // users.title: add column, then backfill from username where empty.
      try {
        db.prepare("ALTER TABLE users ADD COLUMN title TEXT").run();
      } catch {
        // already exists
      }
      db.prepare("UPDATE users SET title = username WHERE title IS NULL").run();

      // Migrate single discordWebhookId -> JSON array discordWebhookIds.
      type RuleWithWebhook = { id: string; discordWebhookId: string | null };
      const rulesToMigrate = db
        .prepare("SELECT id, discordWebhookId FROM rule_instances WHERE discordWebhookId IS NOT NULL AND discordWebhookIds IS NULL")
        .all() as RuleWithWebhook[];
      if (rulesToMigrate.length > 0) {
        const updateStmt = db.prepare("UPDATE rule_instances SET discordWebhookIds = ? WHERE id = ?");
        for (const rule of rulesToMigrate) {
          if (rule.discordWebhookId) {
            updateStmt.run(JSON.stringify([rule.discordWebhookId]), rule.id);
          }
        }
        Logger.info("[Migration] Migrated rule webhooks to multi-select format");
      }

      // Backfill activity_history.userId from the users table (by username, then title).
      const nullCheck = db
        .prepare("SELECT count(*) as count FROM activity_history WHERE userId IS NULL")
        .get() as { count: number };
      if (nullCheck.count > 0) {
        Logger.info("[Migration] Backfilling userIds for activity_history...");
        db.prepare(`
          UPDATE activity_history
          SET userId = (SELECT id FROM users WHERE users.username = activity_history.user AND users.serverId = activity_history.serverId LIMIT 1)
          WHERE userId IS NULL
        `).run();
        db.prepare(`
          UPDATE activity_history
          SET userId = (SELECT id FROM users WHERE users.title = activity_history.user AND users.serverId = activity_history.serverId LIMIT 1)
          WHERE userId IS NULL
        `).run();
        Logger.info("[Migration] Backfill complete.");
      }
    },
  },

  {
    version: 2,
    name: "history_user_stoptime_indexes",
    up: (db) => {
      // Serves getUserStats hot path (period sums, platform/player GROUP BY,
      // recently-played ORDER BY). The existing idx_history_dup_check leads
      // with (user, ratingKey, ...) so it can't satisfy WHERE user=? AND
      // stopTime>?. Both `user` and `userId` variants because user_stats
      // queries are `WHERE user = @username OR userId = @userId` — SQLite
      // uses one index per OR branch.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_history_userid_stoptime
          ON activity_history(userId, stopTime DESC);
        CREATE INDEX IF NOT EXISTS idx_history_user_stoptime
          ON activity_history(user, stopTime DESC);
      `);
    },
  },
  {
    version: 3,
    name: "summary_table_and_retention",
    up: (db) => {
      // Promote `player` from json_extract(meta_json,'$.player') to a real
      // column so getPlayerStats can use the (user, stopTime) index instead
      // of a full scan + per-row JSON eval.
      db.exec(`ALTER TABLE activity_history ADD COLUMN player TEXT`);
      db.prepare(`
        UPDATE activity_history
        SET player = json_extract(meta_json, '$.player')
        WHERE meta_json IS NOT NULL AND player IS NULL
      `).run();

      // Materialized per-user totals updated on every history insert. Same
      // pattern as streak_cache. Period stats (24h/7d/30d) stay on the
      // indexed query — a rolling window would need invalidation/decay logic
      // not worth the complexity at this data volume.
      db.exec(`
        CREATE TABLE user_activity_summary (
          userId TEXT PRIMARY KEY,
          username TEXT,
          total_count INTEGER NOT NULL DEFAULT 0,
          total_duration INTEGER NOT NULL DEFAULT 0,
          last_played_at INTEGER,
          updated_at INTEGER NOT NULL
        );
      `);

      // Backfill the summary from existing history. Bucket by COALESCE(userId, user)
      // so old rows without userId (pre-backfill imports) still aggregate sensibly.
      db.prepare(`
        INSERT INTO user_activity_summary (userId, username, total_count, total_duration, last_played_at, updated_at)
        SELECT
          COALESCE(userId, user) as userId,
          MAX(user) as username,
          COUNT(*) as total_count,
          SUM(duration) as total_duration,
          MAX(stopTime) as last_played_at,
          ? as updated_at
        FROM activity_history
        GROUP BY COALESCE(userId, user)
      `).run(Date.now());

      // Retention sweep targets (see cron.ts). concurrent_snapshots has no
      // timestamp index; rule_events.triggeredAt and jobs.updatedAt are
      // TEXT ISO timestamps, lexicographically sortable.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_concurrent_snapshots_timestamp
          ON concurrent_snapshots(timestamp);
        CREATE INDEX IF NOT EXISTS idx_rule_events_triggered_at
          ON rule_events(triggeredAt);
        CREATE INDEX IF NOT EXISTS idx_jobs_status_updated
          ON jobs(status, updatedAt);
      `);
    },
  },
  {
    version: 4,
    name: "drop_library_groups",
    up: (db) => {
      // The unified-libraries feature was removed; the tables that backed it
      // linger on databases created under main. Drop the child first because
      // it has a FOREIGN KEY on library_groups. IF EXISTS makes this a no-op
      // on databases that never had the feature (refactor-era fresh installs).
      db.exec(`DROP TABLE IF EXISTS library_group_members;`);
      db.exec(`DROP TABLE IF EXISTS library_groups;`);
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
