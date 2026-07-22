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
  {
    // Version 4, not 2: deployed databases already record versions 2-3 from
    // the pre-consolidation migration set (history_user_stoptime_indexes,
    // summary_table_and_retention) whose SQL now lives inside the v1 baseline.
    // Reusing a burned number would make this migration silently skip there.
    version: 4,
    name: "multi_server_identity",
    up: (db) => {
      // --- Canonical identities: server (machineIdentifier), user (plex.tv
      // accountId), media (GUID), stream (serverId+sessionKey). The storage
      // column for accountId keeps the name `userId` in the event tables to
      // limit churn; after this migration it is ALWAYS a valid
      // user_identities.accountId (real, or synthetic "legacy:<name>").
      db.exec(`
        ALTER TABLE servers ADD COLUMN machineIdentifier TEXT;
        ALTER TABLE servers ADD COLUMN ownerAccountId TEXT;
        ALTER TABLE servers ADD COLUMN archivedAt TEXT;
        CREATE UNIQUE INDEX idx_servers_machine ON servers(machineIdentifier)
          WHERE machineIdentifier IS NOT NULL;

        CREATE TABLE user_identities (
          accountId TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          title TEXT NOT NULL,
          email TEXT,
          thumb TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE server_users (
          serverId TEXT NOT NULL,
          accountId TEXT NOT NULL,
          username TEXT,
          title TEXT,
          thumb TEXT,
          isAdmin INTEGER DEFAULT 0,
          importedAt TEXT NOT NULL,
          PRIMARY KEY (serverId, accountId)
        );
        CREATE INDEX idx_server_users_account ON server_users(accountId);

        CREATE TABLE media_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          plex_guid TEXT,
          imdb_id TEXT,
          tmdb_id TEXT,
          tvdb_id TEXT,
          title TEXT NOT NULL,
          year INTEGER,
          showMediaId INTEGER,
          seasonNumber INTEGER,
          episodeNumber INTEGER,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE UNIQUE INDEX idx_media_plex_guid ON media_items(plex_guid)
          WHERE plex_guid IS NOT NULL;
        CREATE UNIQUE INDEX idx_media_episode_by_number
          ON media_items(showMediaId, seasonNumber, episodeNumber)
          WHERE showMediaId IS NOT NULL AND plex_guid IS NULL;
        CREATE INDEX idx_media_tmdb ON media_items(type, tmdb_id);
        CREATE INDEX idx_media_imdb ON media_items(type, imdb_id);
        CREATE INDEX idx_media_tvdb ON media_items(type, tvdb_id);

        CREATE TABLE media_sources (
          serverId TEXT NOT NULL,
          ratingKey TEXT NOT NULL,
          mediaId INTEGER NOT NULL,
          updatedAt TEXT NOT NULL,
          PRIMARY KEY (serverId, ratingKey)
        );
        CREATE INDEX idx_media_sources_media ON media_sources(mediaId);

        ALTER TABLE activity_history ADD COLUMN mediaId INTEGER;
        ALTER TABLE activity_history ADD COLUMN importSource TEXT;
        ALTER TABLE activity_history ADD COLUMN importRef TEXT;
        CREATE UNIQUE INDEX idx_history_import_ref
          ON activity_history(serverId, importSource, importRef)
          WHERE importRef IS NOT NULL;
        DROP INDEX idx_history_dup_check;
        CREATE INDEX idx_history_dup_check
          ON activity_history(serverId, user, ratingKey, startTime);
        CREATE INDEX idx_history_server_start
          ON activity_history(serverId, startTime DESC);
        CREATE INDEX idx_history_media ON activity_history(mediaId);
      `);

      // Flush surviving v1 active sessions to history BEFORE the table is
      // rebuilt — otherwise in-flight watch time is lost on upgrade.
      db.exec(`
        INSERT INTO activity_history (
          id, serverId, userId, user, title, subtitle, ratingKey,
          startTime, stopTime, duration, platform, device, meta_json, pausedCounter
        )
        SELECT
          lower(hex(randomblob(16))), serverId, userId, user, title, subtitle, ratingKey,
          startTime, lastSeen, (lastSeen - startTime) / 1000, platform, device, meta_json, pausedCounter
        FROM active_sessions
        WHERE (lastSeen - startTime) > 10000;

        DROP TABLE active_sessions;
        CREATE TABLE active_sessions (
          serverId TEXT NOT NULL,
          sessionKey TEXT NOT NULL,
          plexSessionId TEXT,
          userId TEXT,
          user TEXT NOT NULL,
          title TEXT NOT NULL,
          subtitle TEXT,
          ratingKey TEXT NOT NULL,
          mediaId INTEGER,
          startTime INTEGER NOT NULL,
          lastSeen INTEGER NOT NULL,
          state TEXT,
          platform TEXT,
          device TEXT,
          ip TEXT,
          meta_json TEXT,
          pausedCounter INTEGER DEFAULT 0,
          pausedSince INTEGER,
          plex_guid TEXT,
          imdb_id TEXT,
          tmdb_id TEXT,
          tvdb_id TEXT,
          PRIMARY KEY (serverId, sessionKey)
        );
        CREATE INDEX idx_active_dup_check
          ON active_sessions(serverId, user, ratingKey, startTime);
      `);

      // users -> user_identities (one row per plex.tv account; the newest
      // importedAt row wins field-wise) + server_users memberships.
      db.exec(`
        INSERT INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
        SELECT id, username, title, email, thumb, minImported, importedAt FROM (
          SELECT u.*,
                 MIN(importedAt) OVER (PARTITION BY id) AS minImported,
                 ROW_NUMBER() OVER (PARTITION BY id ORDER BY importedAt DESC) AS rn
          FROM users u
        ) WHERE rn = 1;

        INSERT INTO server_users (serverId, accountId, username, title, thumb, isAdmin, importedAt)
        SELECT serverId, id, username, title, thumb, isAdmin, importedAt FROM users;

        DROP TABLE users;
      `);

      // History userId backfill — invariant afterwards: every row's userId is
      // a valid user_identities.accountId.
      db.exec(`
        -- 1) Fuzzy-era rows whose userId never existed in the users table:
        --    promote them to real identities (the id IS a plex.tv account id).
        INSERT OR IGNORE INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
        SELECT DISTINCT userId, user, user, NULL, NULL,
               strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
        FROM activity_history
        WHERE userId IS NOT NULL
          AND userId NOT IN (SELECT accountId FROM user_identities);

        -- 2) Name-only rows: match display title first, then username.
        UPDATE activity_history SET userId = COALESCE(
          (SELECT accountId FROM user_identities ui
             WHERE ui.title = activity_history.user COLLATE NOCASE LIMIT 1),
          (SELECT accountId FROM user_identities ui
             WHERE ui.username = activity_history.user COLLATE NOCASE LIMIT 1)
        ) WHERE userId IS NULL;

        -- 3) Whatever remains gets a synthetic legacy identity.
        INSERT OR IGNORE INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
        SELECT DISTINCT 'legacy:' || lower(user), user, user, NULL, NULL,
               strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
        FROM activity_history WHERE userId IS NULL;

        UPDATE activity_history SET userId = 'legacy:' || lower(user) WHERE userId IS NULL;

        -- Tag legacy Tautulli imports so re-imports become idempotent no-ops.
        UPDATE activity_history
        SET importSource = 'tautulli', importRef = substr(id, 10)
        WHERE id LIKE 'tautulli-%';
      `);

      // Aggregates: rebuilt from history, server-qualified, keyed on accountId.
      db.exec(`
        DROP TABLE user_activity_summary;
        CREATE TABLE user_activity_summary (
          accountId TEXT NOT NULL,
          serverId TEXT NOT NULL,
          total_count INTEGER NOT NULL DEFAULT 0,
          total_duration INTEGER NOT NULL DEFAULT 0,
          last_played_at INTEGER,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (accountId, serverId)
        );
        INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
        SELECT userId, serverId, COUNT(*), SUM(duration), MAX(stopTime), strftime('%s','now') * 1000
        FROM activity_history GROUP BY userId, serverId;

        DROP TABLE streak_cache;
        CREATE TABLE streak_cache (
          accountId TEXT PRIMARY KEY,
          currentStreak INTEGER NOT NULL,
          longestStreak INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        ALTER TABLE concurrent_snapshots ADD COLUMN serverId TEXT;
        ALTER TABLE rule_events ADD COLUMN serverId TEXT;
        ALTER TABLE allowed_users ADD COLUMN serverIds TEXT;
      `);
    },
  },
  {
    // Queryable fact columns on activity_history. Until now the stream
    // decision, resolution, bitrate and completion state lived only inside the
    // meta_json blob — unusable for GROUP BY stats/graphs without parsing JSON
    // per row. Values are extracted from the final heartbeat's session meta;
    // rows whose meta lacks a field stay NULL (unknown, not zero).
    version: 5,
    name: "history_fact_columns",
    up: (db) => {
      db.exec(`
        ALTER TABLE activity_history ADD COLUMN transcode_decision TEXT;
        ALTER TABLE activity_history ADD COLUMN video_decision TEXT;
        ALTER TABLE activity_history ADD COLUMN audio_decision TEXT;
        ALTER TABLE activity_history ADD COLUMN video_resolution TEXT;
        ALTER TABLE activity_history ADD COLUMN stream_video_resolution TEXT;
        ALTER TABLE activity_history ADD COLUMN bitrate INTEGER;
        ALTER TABLE activity_history ADD COLUMN bandwidth INTEGER;
        ALTER TABLE activity_history ADD COLUMN location TEXT;
        ALTER TABLE activity_history ADD COLUMN relayed INTEGER;
        ALTER TABLE activity_history ADD COLUMN view_offset_ms INTEGER;
        ALTER TABLE activity_history ADD COLUMN percent_complete INTEGER;
        ALTER TABLE activity_history ADD COLUMN watched INTEGER;
        ALTER TABLE activity_history ADD COLUMN play_duration INTEGER;

        CREATE INDEX idx_history_decision ON activity_history(startTime, transcode_decision);
        CREATE INDEX idx_history_start_platform ON activity_history(startTime, platform);
      `);

      // Backfill from meta_json (PlexSession shape — live captures and the
      // Tautulli mapper both write it). json_valid guards malformed blobs.
      db.exec(`
        UPDATE activity_history SET
          transcode_decision = lower(json_extract(meta_json, '$.decision')),
          video_decision = lower(json_extract(meta_json, '$.videoDecision')),
          audio_decision = lower(json_extract(meta_json, '$.audioDecision')),
          video_resolution = COALESCE(
            json_extract(meta_json, '$.originalHeight'),
            json_extract(meta_json, '$.resolution')
          ),
          stream_video_resolution = CASE
            WHEN lower(json_extract(meta_json, '$.decision')) = 'transcode'
              THEN COALESCE(json_extract(meta_json, '$.transcodeHeight'), json_extract(meta_json, '$.resolution'))
            ELSE COALESCE(json_extract(meta_json, '$.resolution'), json_extract(meta_json, '$.originalHeight'))
          END,
          -- quality is "<n> Mbps"; recover kbps from it (NULL when absent)
          bitrate = CAST(CAST(replace(json_extract(meta_json, '$.quality'), ' Mbps', '') AS REAL) * 1000 AS INTEGER),
          bandwidth = CAST(json_extract(meta_json, '$.bandwidth') AS INTEGER),
          location = json_extract(meta_json, '$.location'),
          relayed = CASE json_extract(meta_json, '$.relayed') WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END,
          view_offset_ms = CAST(json_extract(meta_json, '$.viewOffset') AS INTEGER),
          percent_complete = CASE
            WHEN CAST(json_extract(meta_json, '$.duration') AS INTEGER) > 0
              THEN min(100, CAST(round(
                100.0 * CAST(json_extract(meta_json, '$.viewOffset') AS REAL)
                      / CAST(json_extract(meta_json, '$.duration') AS REAL)
              ) AS INTEGER))
            ELSE NULL
          END
        WHERE meta_json IS NOT NULL AND json_valid(meta_json);

        -- Wallclock duration minus accumulated pause time = actual play time.
        UPDATE activity_history
        SET play_duration = max(0, duration - COALESCE(pausedCounter, 0))
        WHERE duration IS NOT NULL;

        -- Watched threshold: 85% of media runtime (Tautulli convention;
        -- WATCHED_THRESHOLD_PERCENT in src/lib/history/session-facts.ts).
        UPDATE activity_history
        SET watched = CASE WHEN percent_complete >= 85 THEN 1 ELSE 0 END
        WHERE percent_complete IS NOT NULL;
      `);
    },
  },
  {
    // Library inventory, synced per server by src/lib/library/library-sync.ts.
    // Rows are per-server (a title on 4 servers = 4 rows); cross-server unique
    // counts go through mediaId. syncedAt drives deletion of items that
    // disappeared from Plex between syncs.
    version: 6,
    name: "library_tables",
    up: (db) => {
      db.exec(`
        -- Pre-consolidation databases can carry dead library_items /
        -- library_sections tables from the removed unified-library feature
        -- (different schema, no readers since v4). Drop them — the sync job
        -- repopulates the new tables from Plex within minutes of startup.
        DROP TABLE IF EXISTS library_items;
        DROP TABLE IF EXISTS library_sections;

        CREATE TABLE library_sections (
          serverId TEXT NOT NULL,
          sectionKey TEXT NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          itemCount INTEGER,
          updatedAt TEXT,
          PRIMARY KEY (serverId, sectionKey)
        );

        CREATE TABLE library_items (
          serverId TEXT NOT NULL,
          ratingKey TEXT NOT NULL,
          sectionKey TEXT NOT NULL,
          mediaId INTEGER,
          type TEXT,
          title TEXT,
          year INTEGER,
          addedAt INTEGER,
          fileSize INTEGER,
          duration INTEGER,
          syncedAt INTEGER NOT NULL,
          PRIMARY KEY (serverId, ratingKey)
        );
        CREATE INDEX idx_library_items_section ON library_items(serverId, sectionKey);
        CREATE INDEX idx_library_items_media ON library_items(mediaId);
        CREATE INDEX idx_library_items_added ON library_items(addedAt DESC);
      `);
    },
  },
  {
    // The media backfill can now resolve episodes that only carry show-level
    // external ids (show matched via tvdb/imdb once the library sync has
    // enriched canonical items). Rows marked unresolvable by earlier passes
    // deserve a re-evaluation — the backfill re-marks the truly hopeless ones.
    version: 7,
    name: "reset_media_repair_marks",
    up: (db) => {
      db.exec(`
        UPDATE activity_history SET repair_status = NULL
        WHERE repair_status = 'no_media_identity';
      `);
    },
  },
  {
    // Same reset as v7, needed once more: v7 shipped to staging together with
    // the show-external-id path, which turned out to rescue nothing (legacy
    // Guid entries are EPISODE-level). The unique-title show fallback added
    // after re-marks — this reset lets those rows meet it.
    version: 8,
    name: "reset_media_repair_marks_2",
    up: (db) => {
      db.exec(`
        UPDATE activity_history SET repair_status = NULL
        WHERE repair_status = 'no_media_identity';
      `);
    },
  },
  {
    // The Tautulli mapper wrote decision 'directplay' (no space — matches no
    // bucket anywhere) and empty-string per-stream decisions (rendered as
    // Transcode badges in the history modal). Repair both the fact columns
    // and the meta blobs on already-imported rows. NOTE: pre-fix imports
    // collapsed Tautulli's 'copy' (direct stream) into 'directplay'; that
    // distinction is unrecoverable here — a DB-file re-import restores it.
    version: 9,
    name: "repair_import_decisions",
    up: (db) => {
      db.exec(`
        UPDATE activity_history SET transcode_decision = 'direct play'
        WHERE transcode_decision = 'directplay';

        UPDATE activity_history SET video_decision = NULL WHERE video_decision = '';
        UPDATE activity_history SET audio_decision = NULL WHERE audio_decision = '';

        UPDATE activity_history SET meta_json = json_set(meta_json, '$.decision', 'direct play')
        WHERE meta_json IS NOT NULL AND json_valid(meta_json)
          AND json_extract(meta_json, '$.decision') = 'directplay';

        UPDATE activity_history
        SET meta_json = json_set(meta_json, '$.videoDecision', json_extract(meta_json, '$.decision'))
        WHERE meta_json IS NOT NULL AND json_valid(meta_json)
          AND json_extract(meta_json, '$.videoDecision') = '';

        UPDATE activity_history
        SET meta_json = json_set(meta_json, '$.audioDecision', json_extract(meta_json, '$.decision'))
        WHERE meta_json IS NOT NULL AND json_valid(meta_json)
          AND json_extract(meta_json, '$.audioDecision') = '';
      `);
    },
  },
  {
    // Poster thumbs for the libraries page + a per-episode inventory enabling
    // exact unique-episode counts across servers. library_episodes is rebuilt
    // wholesale per section by the 6h library sync; both stay empty until the
    // first post-deploy sync (UI degrades to placeholders/omitted counts).
    version: 10,
    name: "library_thumbs_and_episodes",
    up: (db) => {
      db.exec(`
        ALTER TABLE library_items ADD COLUMN thumb TEXT;

        CREATE TABLE library_episodes (
          serverId TEXT NOT NULL,
          ratingKey TEXT NOT NULL,
          sectionKey TEXT NOT NULL,
          guid TEXT,
          PRIMARY KEY (serverId, ratingKey)
        );
        CREATE INDEX idx_library_episodes_section ON library_episodes(serverId, sectionKey);
        CREATE INDEX idx_library_episodes_guid ON library_episodes(guid);
      `);
    },
  },
  {
    // The streak cache layer was dead code — written by nothing on the live
    // path (getUserStats always computed fresh). Streaks are now one SQL pass
    // over activity_history fact columns (src/lib/stats/streaks.ts); drop the
    // table. NOTE: the legacy-reconcile block still CREATEs this table
    // defensively — required because v4 runs an unguarded DROP on it.
    version: 11,
    name: "drop_streak_cache",
    up: (db) => {
      db.exec(`DROP TABLE IF EXISTS streak_cache;`);
    },
  },
  {
    // Plex reports the server owner as server-local account id "1" in session
    // payloads, so every live-recorded owner play landed under the shared id
    // "1" — invisible to stats/history filtering on the real accountId, and
    // colliding across servers (each server's owner is "1"). Live writes are
    // now translated via servers.ownerAccountId (src/lib/identity/owner-alias.ts);
    // this repairs the rows written before the fix. Rows on servers whose
    // ownerAccountId is still unknown keep the alias — the runtime backfill
    // reattributes them the moment the owner id is learned.
    version: 12,
    name: "reattribute_owner_alias_rows",
    up: (db) => {
      db.exec(`
        -- Owners whose only trace is alias rows need an identity row first;
        -- name it after the newest alias row's user string.
        INSERT OR IGNORE INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
        SELECT s.ownerAccountId,
               (SELECT h.user FROM activity_history h
                 WHERE h.serverId = s.id AND h.userId = '1'
                 ORDER BY h.startTime DESC LIMIT 1),
               (SELECT h.user FROM activity_history h
                 WHERE h.serverId = s.id AND h.userId = '1'
                 ORDER BY h.startTime DESC LIMIT 1),
               NULL, NULL,
               strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
        FROM servers s
        WHERE s.ownerAccountId IS NOT NULL AND s.ownerAccountId NOT IN ('', '1')
          AND EXISTS (SELECT 1 FROM activity_history h WHERE h.serverId = s.id AND h.userId = '1');

        UPDATE activity_history SET userId =
          (SELECT s.ownerAccountId FROM servers s WHERE s.id = activity_history.serverId)
        WHERE userId = '1' AND EXISTS (
          SELECT 1 FROM servers s WHERE s.id = activity_history.serverId
            AND s.ownerAccountId IS NOT NULL AND s.ownerAccountId NOT IN ('', '1'));

        UPDATE active_sessions SET userId =
          (SELECT s.ownerAccountId FROM servers s WHERE s.id = active_sessions.serverId)
        WHERE userId = '1' AND EXISTS (
          SELECT 1 FROM servers s WHERE s.id = active_sessions.serverId
            AND s.ownerAccountId IS NOT NULL AND s.ownerAccountId NOT IN ('', '1'));

        UPDATE rule_events SET userId =
          (SELECT s.ownerAccountId FROM servers s WHERE s.id = rule_events.serverId)
        WHERE userId = '1' AND serverId IS NOT NULL AND EXISTS (
          SELECT 1 FROM servers s WHERE s.id = rule_events.serverId
            AND s.ownerAccountId IS NOT NULL AND s.ownerAccountId NOT IN ('', '1'));

        -- Aggregates: full rebuild, same as v4 — reattribution moved counts
        -- between (accountId, serverId) buckets.
        DELETE FROM user_activity_summary;
        INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
        SELECT userId, serverId, COUNT(*), SUM(duration), MAX(stopTime), strftime('%s','now') * 1000
        FROM activity_history GROUP BY userId, serverId;

        -- Drop the shared alias identity once nothing references it.
        DELETE FROM user_identities
        WHERE accountId = '1'
          AND NOT EXISTS (SELECT 1 FROM activity_history WHERE userId = '1')
          AND NOT EXISTS (SELECT 1 FROM active_sessions WHERE userId = '1')
          AND NOT EXISTS (SELECT 1 FROM rule_events WHERE userId = '1')
          AND NOT EXISTS (SELECT 1 FROM user_rules WHERE userId = '1');
      `);
    },
  },
  {
    // Persistent concurrent-stream peaks per scope ('global' or a serverId).
    // concurrent_snapshots is retention-pruned (90d default), so an all-time
    // peak needs its own row that the sweep never touches. The 'global'
    // sentinel (instead of a NULL serverId) keeps the PK honest for
    // ON CONFLICT upserts — SQLite allows duplicate NULLs in a TEXT PK.
    // Global all-time peak is backfilled from the pre-v13 cross-server
    // snapshot rows (serverId IS NULL); per-server peaks accrue from now,
    // since historical snapshots never carried a serverId. Tie-break:
    // earliest timestamp of the max count = the moment the record was set.
    version: 13,
    name: "stream_peaks",
    up: (db) => {
      db.exec(`
        CREATE TABLE stream_peaks (
          scope TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        INSERT INTO stream_peaks (scope, count, timestamp, updatedAt)
        SELECT 'global', count, timestamp, strftime('%s','now') * 1000
        FROM concurrent_snapshots
        WHERE serverId IS NULL
        ORDER BY count DESC, timestamp ASC
        LIMIT 1;

        CREATE INDEX idx_concurrent_snapshots_server_ts
          ON concurrent_snapshots(serverId, timestamp);
      `);
    },
  },
  {
    // One-time invite links. Only the sha256 of the raw 256-bit link secret is
    // stored — the DB travels in backups and pre-migration VACUUM copies, and
    // a leaked file must not yield live invite URLs. Consumption is a single
    // atomic UPDATE gated on usedAt IS NULL + unexpired, so a link can never
    // be redeemed twice. 'onboarding' invites let the invitee connect their
    // own Plex server; 'access' invites grant a whitelist (viewer) membership.
    version: 14,
    name: "invite_links",
    up: (db) => {
      db.exec(`
        CREATE TABLE invite_links (
          id TEXT PRIMARY KEY,
          tokenHash TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK (type IN ('onboarding','access')),
          label TEXT,
          createdByAccountId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          expiresAt TEXT NOT NULL,
          usedAt TEXT,
          usedByAccountId TEXT,
          serverIds TEXT
        );
      `);
    },
  },
  {
    // Window-first composite for the stats hot path: getTopUsers' windowed
    // GROUP BY userId and the overview summary's COUNT(DISTINCT userId) can
    // answer the startTime range + user grouping from the index alone instead
    // of idx_history_starttime plus a table lookup per row.
    version: 15,
    name: "history_start_user_index",
    up: (db) => {
      db.exec(`
        CREATE INDEX idx_history_start_user ON activity_history(startTime, userId);
      `);
    },
  },
];

/** Highest schema version this build knows — a fully migrated DB sits here. */
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;

/**
 * Databases created before the versioned migration system have all the
 * baseline tables but an EMPTY schema_migrations — running the v1 baseline on
 * them would fail with "table already exists" on live data. Detect that
 * state, defensively add the few pieces such databases can be missing
 * (columns/tables/indexes that the old code added at later points), and stamp
 * the consolidated baseline generation (versions 1-3) so the version gate
 * starts from the correct place.
 *
 * Returns true if the database was reconciled and stamped.
 */
function reconcileLegacyDatabase(db: Database.Database): boolean {
  const hasServers = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'servers'")
    .get();
  if (!hasServers) return false;

  Logger.info("[Migration] Unversioned legacy database detected — reconciling to baseline.");

  const columnsOf = (table: string): Set<string> =>
    new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
    );

  const addColumnIfMissing = (table: string, column: string, ddl: string) => {
    if (!columnsOf(table).has(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      Logger.info(`[Migration] Reconcile: added ${table}.${column}.`);
    }
  };

  addColumnIfMissing("activity_history", "plex_guid", "plex_guid TEXT");
  addColumnIfMissing("activity_history", "imdb_id", "imdb_id TEXT");
  addColumnIfMissing("activity_history", "tmdb_id", "tmdb_id TEXT");
  addColumnIfMissing("activity_history", "tvdb_id", "tvdb_id TEXT");
  addColumnIfMissing("activity_history", "repair_status", "repair_status TEXT");
  addColumnIfMissing("activity_history", "player", "player TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_activity_summary (
      userId TEXT PRIMARY KEY,
      username TEXT,
      total_count INTEGER NOT NULL DEFAULT 0,
      total_duration INTEGER NOT NULL DEFAULT 0,
      last_played_at INTEGER,
      updated_at INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_history_userid_stoptime ON activity_history(userId, stopTime DESC);
    CREATE INDEX IF NOT EXISTS idx_history_user_stoptime ON activity_history(user, stopTime DESC);
    CREATE INDEX IF NOT EXISTS idx_history_plex_guid ON activity_history(plex_guid);
    CREATE INDEX IF NOT EXISTS idx_history_imdb ON activity_history(imdb_id);
    CREATE INDEX IF NOT EXISTS idx_history_tmdb ON activity_history(tmdb_id);
    CREATE INDEX IF NOT EXISTS idx_concurrent_snapshots_timestamp ON concurrent_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_rule_events_triggered_at ON rule_events(triggeredAt);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_updated ON jobs(status, updatedAt);
  `);

  const stamp = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
  );
  const now = new Date().toISOString();
  stamp.run(1, "baseline_schema (stamped by legacy reconcile)", now);
  stamp.run(2, "history_user_stoptime_indexes (stamped by legacy reconcile)", now);
  stamp.run(3, "summary_table_and_retention (stamped by legacy reconcile)", now);

  Logger.info("[Migration] Legacy database reconciled and stamped at version 3.");
  return true;
}

/**
 * Apply every migration whose version is greater than the highest already
 * recorded in `schema_migrations`. Each migration runs inside its own
 * transaction, so a failure rolls back that migration and leaves the recorded
 * version untouched. Safe to call on every startup — fully applied databases
 * do no work.
 */
export function runMigrations(db: Database.Database, targetVersion?: number): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const readVersion = () =>
    (
      db
        .prepare("SELECT MAX(version) as version FROM schema_migrations")
        .get() as { version: number | null }
    ).version ?? 0;

  let currentVersion = readVersion();

  if (currentVersion === 0) {
    const reconcile = db.transaction(() => reconcileLegacyDatabase(db));
    if (reconcile()) {
      currentVersion = readVersion();
    }
  }

  const pending = migrations
    .filter(
      (m) =>
        m.version > currentVersion &&
        (targetVersion === undefined || m.version <= targetVersion)
    )
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    Logger.info(`[Migration] Schema up to date (version ${currentVersion}).`);
    return;
  }

  // Cheap insurance before upgrading an existing database: snapshot the file
  // next to itself. Skipped for fresh (version 0) and in-memory databases.
  if (currentVersion > 0 && db.name && db.name !== ":memory:") {
    const backupPath = `${db.name}.v${currentVersion}-backup-${Date.now()}.db`;
    try {
      db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
      Logger.info(`[Migration] Pre-migration backup written to ${backupPath}`);
    } catch (e) {
      Logger.error("[Migration] Pre-migration backup failed; continuing (migrations are transactional).", e);
    }
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
