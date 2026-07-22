import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import {
  seedV1Fixture,
  SRV_A,
  SRV_B,
  ACC_ELIAS,
  ACC_FRANK,
  ACC_GHOST,
  BASE_TIME,
} from "./fixtures/v1-seed";
import type { CountRow } from "@/lib/db-types";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

describe("migration v2: multi_server_identity", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb(1);
    seedV1Fixture(db);
    migrateTo(db);
  });

  afterEach(() => {
    db.close();
  });

  it("reaches the latest schema version (2-3 are burned by the pre-consolidation set)", () => {
    const row = db
      .prepare("SELECT MAX(version) as version FROM schema_migrations")
      .get() as { version: number };
    expect(row.version).toBe(LATEST_SCHEMA_VERSION);
  });

  it("collapses duplicate multi-server users into one identity + memberships", () => {
    const identities = db
      .prepare("SELECT COUNT(*) as count FROM user_identities WHERE accountId = ?")
      .get(ACC_ELIAS) as CountRow;
    expect(identities.count).toBe(1);

    const memberships = db
      .prepare("SELECT serverId FROM server_users WHERE accountId = ? ORDER BY serverId")
      .all(ACC_ELIAS) as { serverId: string }[];
    expect(memberships.map((m) => m.serverId).sort()).toEqual([SRV_A, SRV_B].sort());

    // Old users table is gone.
    const usersTable = db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as CountRow;
    expect(usersTable.count).toBe(0);
  });

  it("backfills every history row to a valid identity (zero NULL userId)", () => {
    const nulls = db
      .prepare("SELECT COUNT(*) as count FROM activity_history WHERE userId IS NULL")
      .get() as CountRow;
    expect(nulls.count).toBe(0);

    // Name-only row matched by username (case-insensitive).
    const h2 = db.prepare("SELECT userId FROM activity_history WHERE id = 'h2'").get() as {
      userId: string;
    };
    expect(h2.userId).toBe(ACC_ELIAS);

    // Unmatchable row got a synthetic legacy identity.
    const h3 = db.prepare("SELECT userId FROM activity_history WHERE id = 'h3'").get() as {
      userId: string;
    };
    expect(h3.userId).toBe("legacy:orphanguy");
    const legacy = db
      .prepare("SELECT username FROM user_identities WHERE accountId = 'legacy:orphanguy'")
      .get() as { username: string };
    expect(legacy.username).toBe("OrphanGuy");

    // Fuzzy-era userId that never existed in `users` was promoted to an identity.
    const ghost = db
      .prepare("SELECT username FROM user_identities WHERE accountId = ?")
      .get(ACC_GHOST) as { username: string };
    expect(ghost.username).toBe("Ghosty");

    // Every history userId resolves to an identity.
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as count FROM activity_history h
         WHERE NOT EXISTS (SELECT 1 FROM user_identities ui WHERE ui.accountId = h.userId)`
      )
      .get() as CountRow;
    expect(orphans.count).toBe(0);
  });

  it("flushes surviving v1 active sessions to history and drops short ones", () => {
    const flushed = db
      .prepare(
        "SELECT * FROM activity_history WHERE ratingKey = '4242' AND serverId = ?"
      )
      .get(SRV_A) as { userId: string; duration: number; stopTime: number } | undefined;
    expect(flushed).toBeDefined();
    expect(flushed!.userId).toBe(ACC_ELIAS);
    expect(flushed!.duration).toBe(1800);
    expect(flushed!.stopTime).toBe(BASE_TIME + 10 * 3600000 + 1800000);

    const dropped = db
      .prepare("SELECT COUNT(*) as count FROM activity_history WHERE ratingKey = '31'")
      .get() as CountRow;
    expect(dropped.count).toBe(0);

    const active = db.prepare("SELECT COUNT(*) as count FROM active_sessions").get() as CountRow;
    expect(active.count).toBe(0);
  });

  it("tags legacy tautulli imports with importSource/importRef", () => {
    const row = db
      .prepare("SELECT importSource, importRef FROM activity_history WHERE id = 'tautulli-555'")
      .get() as { importSource: string; importRef: string };
    expect(row.importSource).toBe("tautulli");
    expect(row.importRef).toBe("555");

    // The unique import index rejects a re-import of the same (server, source, ref).
    expect(() =>
      db
        .prepare(
          `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey,
             startTime, stopTime, duration, importSource, importRef)
           VALUES ('dupe', ?, ?, 'Elias', 'The Show', '9001', 1, 2, 1, 'tautulli', '555')`
        )
        .run(SRV_A, ACC_ELIAS)
    ).toThrow(/UNIQUE/);
  });

  it("rebuilds user_activity_summary per (accountId, serverId) from history", () => {
    const eliasA = db
      .prepare(
        "SELECT total_count, total_duration FROM user_activity_summary WHERE accountId = ? AND serverId = ?"
      )
      .get(ACC_ELIAS, SRV_A) as { total_count: number; total_duration: number };
    // h1 (7200s) + tautulli-555 (1800s) + flushed live session (1800s).
    expect(eliasA.total_count).toBe(3);
    expect(eliasA.total_duration).toBe(10800);

    const eliasB = db
      .prepare(
        "SELECT total_count, total_duration FROM user_activity_summary WHERE accountId = ? AND serverId = ?"
      )
      .get(ACC_ELIAS, SRV_B) as { total_count: number; total_duration: number };
    expect(eliasB.total_count).toBe(1);
    expect(eliasB.total_duration).toBe(3600);

    const frankB = db
      .prepare(
        "SELECT total_count FROM user_activity_summary WHERE accountId = ? AND serverId = ?"
      )
      .get(ACC_FRANK, SRV_B) as { total_count: number };
    expect(frankB.total_count).toBe(1);

    // The streak cache was truncated by v2 and the table dropped by v11.
    const streakTables = db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'streak_cache'")
      .get() as CountRow;
    expect(streakTables.count).toBe(0);
  });

  it("allows the same sessionKey on different servers but not twice per server", () => {
    const insert = db.prepare(
      `INSERT INTO active_sessions (serverId, sessionKey, userId, user, title, ratingKey, startTime, lastSeen)
       VALUES (?, ?, ?, 'Elias', 'Movie', '1234', 1, 2)`
    );
    insert.run(SRV_A, "17", ACC_ELIAS);
    // Same sessionKey (and even ratingKey) on another server: fine.
    expect(() => insert.run(SRV_B, "17", ACC_ELIAS)).not.toThrow();
    // Same (serverId, sessionKey) again: rejected.
    expect(() => insert.run(SRV_A, "17", ACC_ELIAS)).toThrow(/UNIQUE|PRIMARY/);
  });

  it("applies on a real-world v3 database (burned versions 2-3 + legacy columns)", () => {
    // Deployed DBs were migrated by the pre-consolidation set: they record
    // versions 2-3 and carry dead columns from the removed unified-library
    // feature. The v4 migration must still apply cleanly there.
    const db3 = createTestDb(1);
    db3.exec(`
      ALTER TABLE activity_history ADD COLUMN unifiedItemId TEXT;
      ALTER TABLE activity_history ADD COLUMN unifiedParentId TEXT;
      ALTER TABLE active_sessions ADD COLUMN unifiedItemId TEXT;
      INSERT INTO schema_migrations (version, name, applied_at) VALUES
        (2, 'history_user_stoptime_indexes', '2026-05-28T00:00:00Z'),
        (3, 'summary_table_and_retention', '2026-05-28T00:00:00Z');
    `);
    seedV1Fixture(db3);
    migrateTo(db3);

    const version = db3
      .prepare("SELECT MAX(version) as version FROM schema_migrations")
      .get() as { version: number };
    expect(version.version).toBe(LATEST_SCHEMA_VERSION);

    const identities = db3
      .prepare("SELECT COUNT(*) as count FROM user_identities")
      .get() as CountRow;
    expect(identities.count).toBeGreaterThan(0);

    const nulls = db3
      .prepare("SELECT COUNT(*) as count FROM activity_history WHERE userId IS NULL")
      .get() as CountRow;
    expect(nulls.count).toBe(0);

    db3.close();
  });

  it("reconciles a legacy UNVERSIONED database (pre-migration-system) and applies v4", () => {
    // Databases created before the versioned migration system have all the
    // baseline tables but an empty schema_migrations, and are missing the
    // later additions (player/repair_status columns, user_activity_summary).
    const legacy = createTestDb(1);
    seedV1Fixture(legacy);
    legacy.exec(`
      DELETE FROM schema_migrations;
      ALTER TABLE activity_history DROP COLUMN player;
      ALTER TABLE activity_history DROP COLUMN repair_status;
      DROP TABLE user_activity_summary;
      DROP INDEX idx_history_userid_stoptime;
    `);

    migrateTo(legacy);

    const version = legacy
      .prepare("SELECT MAX(version) as version FROM schema_migrations")
      .get() as { version: number };
    expect(version.version).toBe(LATEST_SCHEMA_VERSION);

    // Reconcile restored the missing pieces before v4 ran.
    const historyCols = (legacy.prepare("PRAGMA table_info(activity_history)").all() as {
      name: string;
    }[]).map((c) => c.name);
    expect(historyCols).toContain("player");
    expect(historyCols).toContain("repair_status");
    expect(historyCols).toContain("mediaId");

    const nulls = legacy
      .prepare("SELECT COUNT(*) as count FROM activity_history WHERE userId IS NULL")
      .get() as CountRow;
    expect(nulls.count).toBe(0);

    const summary = legacy
      .prepare("SELECT SUM(total_count) as count FROM user_activity_summary")
      .get() as CountRow;
    const history = legacy
      .prepare("SELECT COUNT(*) as count FROM activity_history")
      .get() as CountRow;
    expect(summary.count).toBe(history.count);

    legacy.close();
  });

  it("keeps allowed_users and servers intact with new nullable columns", () => {
    const wl = db
      .prepare("SELECT email, serverIds FROM allowed_users WHERE id = 'wl1'")
      .get() as { email: string; serverIds: string | null };
    expect(wl.email).toBe("friend@example.com");
    expect(wl.serverIds).toBeNull();

    const srv = db
      .prepare("SELECT machineIdentifier, archivedAt FROM servers WHERE id = ?")
      .get(SRV_A) as { machineIdentifier: string | null; archivedAt: string | null };
    expect(srv.machineIdentifier).toBeNull();
    expect(srv.archivedAt).toBeNull();
  });
});
